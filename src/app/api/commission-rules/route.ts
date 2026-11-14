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

    const newRule = await prisma.commissionRule.create({
      data: {
        tierId: data.tierId,
        tariff: data.tariff || null,
        productType: data.productType || null,
        ...(data.productIds &&
          data.productIds.length > 0 && {
            products: { connect: data.productIds.map((id: string) => ({ id })) },
          }),
        ...(data.serviceIds &&
          data.serviceIds.length > 0 && {
            additionalServices: { connect: data.serviceIds.map((id: string) => ({ id })) },
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
