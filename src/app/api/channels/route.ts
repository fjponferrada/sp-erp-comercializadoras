import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';

export async function POST(req: Request) {
  try {
    const access = await getBrandAccessContext();
    if (!access || (access.role !== 'SUPERADMIN' && access.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const targetBrandId = access.activeBrandId;
    if (!targetBrandId || !access.canAccessBrand(targetBrandId)) {
      return NextResponse.json({ error: 'Sin permisos sobre la marca seleccionada' }, { status: 403 });
    }

    const data = await req.json();
    if (!data.nombre?.trim() || !data.codigo?.trim()) {
      return NextResponse.json({ error: 'Nombre y código de canal son obligatorios' }, { status: 400 });
    }

    let validTierId: string | null = null;
    if (data.commissionTierId) {
      const tier = await prisma.commissionTier.findFirst({
        where: { id: data.commissionTierId, brandId: targetBrandId },
        select: { id: true },
      });
      if (!tier) {
        return NextResponse.json(
          { error: 'El Nivel de Comisión seleccionado no pertenece a la marca activa' },
          { status: 400 }
        );
      }
      validTierId = tier.id;
    }

    let validProductIds: string[] = [];
    if (Array.isArray(data.productIds) && data.productIds.length > 0) {
      const validProducts = await prisma.product.findMany({
        where: { id: { in: data.productIds }, brandId: targetBrandId },
        select: { id: true },
      });
      validProductIds = validProducts.map((p) => p.id);
    }

    const newChannel = await prisma.channel.create({
      data: {
        name: String(data.nombre).trim(),
        code: String(data.codigo).trim(),
        fixedCommissionPct: Number(data.comisionFijo) || 0,
        variableCommissionPct: Number(data.comisionVariable) || 0,
        supervisorEmail: data.email ? String(data.email).trim() : null,
        adminEmail: data.adminEmail ? String(data.adminEmail).trim() : null,
        managerEmail: data.managerEmail ? String(data.managerEmail).trim() : null,
        supportEmail: data.supportEmail ? String(data.supportEmail).trim() : null,
        autoGenerateContract: Boolean(data.autoGenerateContract),
        maxRenewalDays: data.maxRenewalDays !== undefined ? Number(data.maxRenewalDays) : 45,
        commissionTierId: validTierId,
        brandId: targetBrandId,
        ...(validProductIds.length > 0
          ? { products: { connect: validProductIds.map((pid) => ({ id: pid })) } }
          : {}),
      },
    });

    return NextResponse.json(newChannel);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código de canal ya existe' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error interno al crear el canal' }, { status: 500 });
  }
}
