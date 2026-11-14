import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveBrand } from '@/lib/permissions';
import {
  computeModelo560,
  ExportMode560,
  getQuarterMadridBounds,
  IeeRateBucket,
} from '@/lib/taxUtils';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as string | undefined;
    if (userRole && !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole)) {
      return NextResponse.json({ error: 'Permisos insuficientes para liquidación fiscal' }, { status: 403 });
    }

    const activeBrandId = await getActiveBrand(session.user);
    if (!activeBrandId) {
      return NextResponse.json({ error: 'No hay marca activa seleccionada' }, { status: 400 });
    }

    const url = new URL(req.url);
    const yearStr = url.searchParams.get('year');
    const quarterStr = url.searchParams.get('quarter');
    const scope = url.searchParams.get('scope') === 'company' ? 'company' : 'brand';
    const modeParam = url.searchParams.get('mode');
    const mode: ExportMode560 = modeParam === 'neteado' ? 'neteado' : 'oficial';
    const adjustCents = url.searchParams.get('adjustCents') !== 'false';
    const rateParam = (url.searchParams.get('rate') || '5.11') as IeeRateBucket;
    const validRates: IeeRateBucket[] = ['5.11', '3.8', '2.5', '0.5'];
    const targetRateBucket: IeeRateBucket = validRates.includes(rateParam) ? rateParam : '5.11';

    if (!yearStr || !quarterStr) {
      return NextResponse.json({ error: 'Falta año o trimestre' }, { status: 400 });
    }

    const year = parseInt(yearStr, 10);
    const quarter = parseInt(quarterStr, 10);
    if (Number.isNaN(year) || Number.isNaN(quarter) || quarter < 1 || quarter > 4) {
      return NextResponse.json({ error: 'Año o trimestre inválido' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
      include: {
        company: {
          include: {
            brands: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    const { startDate, endDate } = getQuarterMadridBounds(year, quarter);

    const clientWhere =
      scope === 'company' && brand.companyId
        ? { brand: { companyId: brand.companyId } }
        : { brandId: activeBrandId };

    const invoices = await prisma.invoice.findMany({
      where: {
        client: clientWhere,
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        subtotal1: true,
        taxPercentage: true,
        taxAmount: true,
        totalMWh: true,
        origin: true,
        invoiceData: true,
        client: {
          select: {
            vatNumber: true,
          },
        },
        supplyPoint: {
          select: {
            cups: true,
            postalCode: true,
            sipsPostalCode: true,
            province: true,
            tariff: true,
            cnae: true,
            regimenFiscal: true,
            cie: true,
            ieDiscount: true,
          },
        },
      },
      orderBy: { issueDate: 'asc' },
    });

    const declarantCie = brand.company?.cie || '';
    const companyName = brand.company?.name || brand.name;

    const computation = computeModelo560({
      invoices,
      declarantCie,
      companyName,
      targetRateBucket,
      mode,
      adjustCents,
    });

    return NextResponse.json({
      results: computation.summaryRows,
      cuadrosByZone: computation.cuadrosByZone,
      warnings: computation.warnings,
      cieErrors: computation.cieErrors,
      historicalZones: computation.historicalZones,
      declarantCie: computation.declarantCie,
      companyName,
      brandName: brand.name,
      companyBrandsCount: brand.company?.brands?.length || 1,
      scope,
      mode,
      adjustCents,
      rateBucket: targetRateBucket,
    });
  } catch (error: any) {
    console.error('Error calculando IE:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
