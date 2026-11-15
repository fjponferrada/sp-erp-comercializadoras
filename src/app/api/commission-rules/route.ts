import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = await getActiveBrand();
    const data = await req.json();

    const tier = await prisma.commissionTier.findUnique({
      where: { id: data.tierId },
    });
    if (!tier || (session.user.role !== 'SUPERADMIN' && tier.brandId !== activeBrandId)) {
      return NextResponse.json({ error: 'Nivel de comisión no encontrado o sin acceso autorizado' }, { status: 404 });
    }

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

    const [validProducts, validServices] = await Promise.all([
      rawProductIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: rawProductIds }, ...(tier.brandId ? { brandId: tier.brandId } : {}) },
            select: { id: true },
          })
        : Promise.resolve([]),
      rawServiceIds.length > 0
        ? prisma.additionalService.findMany({
            where: { id: { in: rawServiceIds }, ...(tier.brandId ? { brandId: tier.brandId } : {}) },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const newRule = await prisma.commissionRule.create({
      data: {
        tierId: data.tierId,
        tariff: data.tariff || null,
        productType: data.productType || null,
        ...(validProducts.length > 0 && {
          products: { connect: validProducts.map((p) => ({ id: p.id })) },
        }),
        ...(validServices.length > 0 && {
          additionalServices: { connect: validServices.map((s) => ({ id: s.id })) },
        }),
        powerMin,
        powerMax,
        commissionType: data.commissionType || 'PERCENTAGE',
        value: numericValue,
      },
    });

    return NextResponse.json(newRule);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
