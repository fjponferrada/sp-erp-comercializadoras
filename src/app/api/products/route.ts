import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    // The user needs a brandId. For superadmins creating a product, we use their current selected brand.
    // However, the simplest way is just to take their primary brand or first assigned brand,
    // or we could require brandId from frontend. Let's just use the user's primary brandId.
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newProduct = await prisma.product.create({
      data: {
        name: data.name,
        type: data.type,
        tariff: data.tariff,
        isAvailableCrm: data.isAvailableCrm,
        isCustomizable: data.isCustomizable,
        pricingModel: data.pricingModel,
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

        brandId: user.brandId
      }
    });

    return NextResponse.json(newProduct);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const whereClause: any = {
      brandId: user.brandId,
      isAvailableCrm: true
    };

    if (['CANAL', 'COMERCIAL'].includes(user.role) && user.channelId) {
      whereClause.channels = {
        some: { id: user.channelId }
      };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
