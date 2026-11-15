import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand, getBrandAccessContext } from '@/lib/permissions';

function toNullableFloat(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    const access = await getBrandAccessContext();
    if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await req.json();
    if (!data.name || !String(data.name).trim()) {
      return NextResponse.json({ error: 'El nombre del producto es obligatorio' }, { status: 400 });
    }

    const targetBrandId = access.activeBrandId;
    if (!targetBrandId || !access.canAccessBrand(targetBrandId)) {
      return NextResponse.json({ error: 'Sin permisos sobre la marca seleccionada' }, { status: 403 });
    }

    const newProduct = await prisma.product.create({
      data: {
        name: String(data.name).trim(),
        type: data.type ? String(data.type).trim() : (data.pricingModel === 'INDEXED' ? 'Indexado' : 'Fijo'),
        tariff: data.tariff ? String(data.tariff).trim() : null,
        isAvailableCrm: data.isAvailableCrm ?? true,
        isCustomizable: Boolean(data.isCustomizable),
        pricingModel: data.pricingModel || 'FIXED',
        permanenceMonths: data.permanenceMonths !== undefined && data.permanenceMonths !== '' ? Number(data.permanenceMonths) : null,

        hasSelfConsumption: Boolean(data.hasSelfConsumption),
        selfConsumptionType: data.selfConsumptionType || 'No aplica',
        pexc: toNullableFloat(data.pexc),
        feeExcedentes: toNullableFloat(data.feeExcedentes),
        cgBolsilloSolar: toNullableFloat(data.cgBolsilloSolar),

        fee: toNullableFloat(data.fee),
        deviationCost: toNullableFloat(data.deviationCost),
        commissionType: data.commissionType || 'MARGIN_PERCENTAGE',

        p1p: toNullableFloat(data.p1p),
        p2p: toNullableFloat(data.p2p),
        p3p: toNullableFloat(data.p3p),
        p4p: toNullableFloat(data.p4p),
        p5p: toNullableFloat(data.p5p),
        p6p: toNullableFloat(data.p6p),

        p1e: toNullableFloat(data.p1e),
        p2e: toNullableFloat(data.p2e),
        p3e: toNullableFloat(data.p3e),
        p4e: toNullableFloat(data.p4e),
        p5e: toNullableFloat(data.p5e),
        p6e: toNullableFloat(data.p6e),

        marginFC: toNullableFloat(data.marginFC),
        ip1: toNullableFloat(data.ip1),
        ip2: toNullableFloat(data.ip2),
        ip3: toNullableFloat(data.ip3),
        ip4: toNullableFloat(data.ip4),
        ip5: toNullableFloat(data.ip5),
        ip6: toNullableFloat(data.ip6),

        brandId: targetBrandId,
      },
    });

    return NextResponse.json(newProduct);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno al crear el producto' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    const isApiKey = Boolean(token && process.env.AED_API_KEY && token === process.env.AED_API_KEY);

    let targetBrandId: string;
    let allowedChannels: string[] | null = null;
    let isExternalRole = false;

    if (isApiKey) {
      const brandId = req.headers.get('x-brand-id');
      if (!brandId) return NextResponse.json({ success: false, error: 'Falta X-Brand-Id' }, { status: 400 });
      targetBrandId = brandId;

      // Buscar el usuario "Web" para heredar sus permisos de canal
      const apiUser = await prisma.user.findFirst({
        where: { brandId: brandId, role: 'CANAL', name: { contains: 'Web', mode: 'insensitive' } },
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
        where: { email: { equals: (session.user.email as string).trim(), mode: 'insensitive' } },
      });

      if (!user || user.isActive === false || user.role === 'CLIENT') {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }

      if (['CANAL', 'COMERCIAL'].includes(user.role)) {
        isExternalRole = true;
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
      isAvailableCrm: true,
    };

    if (allowedChannels) {
      whereClause.channels = {
        some: { id: { in: allowedChannels } },
      };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    // Regla confidencialidad GUIA_COMISIONES: ocultar márgenes mayoristas internos a roles externos y API Key
    const hideInternalMargins = isApiKey || isExternalRole || allowedChannels !== null;
    const safeProducts = hideInternalMargins
      ? products.map(({ marginFC, ip1, ip2, ip3, ip4, ip5, ip6, airtableData, ...rest }) => rest)
      : products;

    return NextResponse.json({ success: true, data: safeProducts });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
