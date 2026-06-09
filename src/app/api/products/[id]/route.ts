import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        tariff: data.tariff,
        isAvailableCrm: data.isAvailableCrm,
        permanenceMonths: data.permanenceMonths,
        
        hasSelfConsumption: data.hasSelfConsumption,
        selfConsumptionType: data.selfConsumptionType,
        pexc: data.pexc,
        feeExcedentes: data.feeExcedentes,
        cgBolsilloSolar: data.cgBolsilloSolar,


        fee: data.fee,
        deviationCost: data.deviationCost,
        commissionType: data.commissionType,

        p1p: data.p1p,
        p2p: data.p2p,
        p3p: data.p3p,
        p4p: data.p4p,
        p5p: data.p5p,
        p6p: data.p6p,

        p1e: data.p1e,
        p2e: data.p2e,
        p3e: data.p3e,
        p4e: data.p4e,
        p5e: data.p5e,
        p6e: data.p6e,


      }
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
