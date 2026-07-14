import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const newRule = await prisma.commissionRule.create({
      data: {
        tierId: data.tierId,
        tariff: data.tariff || null,
        productType: data.productType || null,
        ...(data.productIds && data.productIds.length > 0 && {
          products: { connect: data.productIds.map((id: string) => ({ id })) }
        }),
        ...(data.serviceIds && data.serviceIds.length > 0 && {
          additionalServices: { connect: data.serviceIds.map((id: string) => ({ id })) }
        }),
        powerMin: data.powerMin !== '' && data.powerMin !== null ? parseFloat(data.powerMin) : null,
        powerMax: data.powerMax !== '' && data.powerMax !== null ? parseFloat(data.powerMax) : null,
        commissionType: data.commissionType || 'PERCENTAGE',
        value: parseFloat(data.value) || 0
      }
    });

    return NextResponse.json(newRule);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
