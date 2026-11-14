import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    const user = await prisma.user.findFirst({
      where: { email: { equals: (session.user.email as string).trim(), mode: 'insensitive' } }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const activeBrandId = await getActiveBrand(user);

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

        brandId: activeBrandId || user.brandId
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
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    const isApiKey = token && token === process.env.AED_API_KEY;

    let targetBrandId: string;
    let allowedChannels: string[] | null = null;

    if (isApiKey) {
      const brandId = req.headers.get('x-brand-id');
      if (!brandId) return NextResponse.json({ success: false, error: 'Falta X-Brand-Id' }, { status: 400 });
      targetBrandId = brandId;
      
      // Buscar el usuario "Web" para heredar sus permisos de canal
      const apiUser = await prisma.user.findFirst({
        where: { brandId: brandId, role: 'CANAL', name: { contains: 'Web', mode: 'insensitive' } }
      });
      if (apiUser && apiUser.channelId) {
        allowedChannels = [apiUser.channelId];
      }
    } else {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: (session.user.email as string).trim(), mode: 'insensitive' } }
      });
      
      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
      if (['CANAL', 'COMERCIAL'].includes(user.role)) {
        targetBrandId = user.brandId;
        if (user.channelId) {
          allowedChannels = [user.channelId];
        }
      } else {
        targetBrandId = (await getActiveBrand(user)) || user.brandId;
      }
    }

    const whereClause: any = {
      brandId: targetBrandId,
      isAvailableCrm: true
    };

    if (allowedChannels) {
      whereClause.channels = {
        some: { id: { in: allowedChannels } }
      };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    // Regla confidencialidad GUIA_COMISIONES: ocultar márgenes mayoristas internos a roles externos
    const hideInternalMargins = isApiKey || allowedChannels !== null;
    const safeProducts = hideInternalMargins
      ? products.map(({ marginFC, ip1, ip2, ip3, ip4, ip5, ip6, ...rest }) => rest)
      : products;

    return NextResponse.json({ success: true, data: safeProducts });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
