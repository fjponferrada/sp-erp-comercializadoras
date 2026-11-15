import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await getBrandAccessContext();
    if (!access || (access.role !== 'SUPERADMIN' && access.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const existingChannel = await prisma.channel.findUnique({
      where: { id },
    });

    if (!existingChannel || !access.canAccessBrand(existingChannel.brandId)) {
      return NextResponse.json({ error: 'Canal no encontrado o sin acceso autorizado' }, { status: 404 });
    }

    const data = await req.json();
    if (!data.nombre?.trim() || !data.codigo?.trim()) {
      return NextResponse.json({ error: 'Nombre y código de canal son obligatorios' }, { status: 400 });
    }

    let validTierId: string | null = null;
    if (data.commissionTierId) {
      const tier = await prisma.commissionTier.findFirst({
        where: {
          id: data.commissionTierId,
          ...(existingChannel.brandId ? { brandId: existingChannel.brandId } : {}),
        },
        select: { id: true },
      });
      if (!tier) {
        return NextResponse.json(
          { error: 'El Nivel de Comisión seleccionado no pertenece a la marca de este canal' },
          { status: 400 }
        );
      }
      validTierId = tier.id;
    }

    let validProductSet: { id: string }[] | undefined = undefined;
    if (Array.isArray(data.productIds)) {
      const validProducts = await prisma.product.findMany({
        where: {
          id: { in: data.productIds },
          ...(existingChannel.brandId ? { brandId: existingChannel.brandId } : {}),
        },
        select: { id: true },
      });
      validProductSet = validProducts.map((p) => ({ id: p.id }));
    }

    const updated = await prisma.channel.update({
      where: { id },
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
        maxRenewalDays: data.maxRenewalDays !== undefined ? Number(data.maxRenewalDays) : existingChannel.maxRenewalDays,
        commissionTierId: validTierId,
        ...(validProductSet !== undefined ? { products: { set: validProductSet } } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código de canal ya existe' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error interno al actualizar el canal' }, { status: 500 });
  }
}
