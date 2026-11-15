import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = await getActiveBrand();
    const resolvedParams = await params;

    const existing = await prisma.commissionRule.findUnique({
      where: { id: resolvedParams.id },
      include: { tier: { select: { brandId: true } } },
    });
    if (!existing || (session.user.role !== 'SUPERADMIN' && existing.tier.brandId !== activeBrandId)) {
      return NextResponse.json({ error: 'Regla no encontrada o sin acceso autorizado' }, { status: 404 });
    }

    const data = await req.json();
    const powerMin = data.powerMin !== '' && data.powerMin !== null && data.powerMin !== undefined ? parseFloat(data.powerMin) : null;
    const powerMax = data.powerMax !== '' && data.powerMax !== null && data.powerMax !== undefined ? parseFloat(data.powerMax) : null;

    if (powerMin !== null && powerMax !== null && powerMin >= powerMax) {
      return NextResponse.json(
        { error: 'La potencia mínima debe ser estrictamente menor que la potencia máxima' },
        { status: 400 }
      );
    }

    const numericValue = parseFloat(data.value);
    if (!Number.isFinite(numericValue)) {
      return NextResponse.json({ error: 'El valor numérico de la regla no es válido' }, { status: 400 });
    }

    const rawProductIds: string[] = Array.isArray(data.productIds) ? data.productIds : [];
    const rawServiceIds: string[] = Array.isArray(data.serviceIds) ? data.serviceIds : [];
    const tierBrandId = existing.tier.brandId;

    const [validProducts, validServices] = await Promise.all([
      rawProductIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: rawProductIds }, ...(tierBrandId ? { brandId: tierBrandId } : {}) },
            select: { id: true },
          })
        : Promise.resolve([]),
      rawServiceIds.length > 0
        ? prisma.additionalService.findMany({
            where: { id: { in: rawServiceIds }, ...(tierBrandId ? { brandId: tierBrandId } : {}) },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const updated = await prisma.commissionRule.update({
      where: { id: resolvedParams.id },
      data: {
        tariff: data.tariff || null,
        productType: data.productType || null,
        products: { set: validProducts.map((p) => ({ id: p.id })) },
        additionalServices: { set: validServices.map((s) => ({ id: s.id })) },
        powerMin,
        powerMax,
        commissionType: data.commissionType || 'PERCENTAGE',
        value: numericValue,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = await getActiveBrand();
    const resolvedParams = await params;

    const existing = await prisma.commissionRule.findUnique({
      where: { id: resolvedParams.id },
      include: { tier: { select: { brandId: true } } },
    });
    if (!existing || (session.user.role !== 'SUPERADMIN' && existing.tier.brandId !== activeBrandId)) {
      return NextResponse.json({ error: 'Regla no encontrada o sin acceso autorizado' }, { status: 404 });
    }

    await prisma.commissionRule.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
