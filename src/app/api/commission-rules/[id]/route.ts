import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const data = await req.json();
    const updated = await prisma.commissionRule.update({
      where: { id: resolvedParams.id },
      data: {
        tariff: data.tariff || null,
        productType: data.productType || null,
        products: { set: data.productIds ? data.productIds.map((id: string) => ({ id })) : [] },
        additionalServices: { set: data.serviceIds ? data.serviceIds.map((id: string) => ({ id })) : [] },
        powerMin: data.powerMin !== '' && data.powerMin !== null ? parseFloat(data.powerMin) : null,
        powerMax: data.powerMax !== '' && data.powerMax !== null ? parseFloat(data.powerMax) : null,
        commissionType: data.commissionType || 'PERCENTAGE',
        value: parseFloat(data.value) || 0
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    await prisma.commissionRule.delete({
      where: { id: resolvedParams.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
