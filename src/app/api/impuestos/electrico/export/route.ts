import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveBrand } from '@/lib/permissions';
import {
  computeModelo560,
  ExportMode560,
  getQuarterMadridBounds,
  IeeRateBucket,
  normalizeAsciiUpper,
} from '@/lib/taxUtils';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as string | undefined;
    if (userRole && !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole)) {
      return NextResponse.json({ error: 'Permisos insuficientes para exportar Modelo 560' }, { status: 403 });
    }

    const activeBrandId = await getActiveBrand(session.user);
    if (!activeBrandId) {
      return NextResponse.json({ error: 'No hay marca activa seleccionada' }, { status: 400 });
    }

    const url = new URL(req.url);
    const yearStr = url.searchParams.get('year');
    const quarterStr = url.searchParams.get('quarter');
    const targetZona = url.searchParams.get('zona');
    const scope = url.searchParams.get('scope') === 'company' ? 'company' : 'brand';
    const modeParam = url.searchParams.get('mode');
    const mode: ExportMode560 = modeParam === 'neteado' ? 'neteado' : 'oficial';
    const adjustCents = url.searchParams.get('adjustCents') !== 'false';
    const customCie = url.searchParams.get('cie');
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
      include: { company: true },
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

    // Permite sobrescribir el CIE del declarante (ej. CIE Foral para Navarra/País Vasco o dejar vacío si Pago No Centralizado)
    const declarantCie =
      customCie !== null ? customCie.trim().toUpperCase() : (brand.company?.cie || '').trim().toUpperCase();

    const computation = computeModelo560({
      invoices,
      declarantCie,
      companyName: brand.company?.name || brand.name,
      targetRateBucket,
      mode,
      adjustCents,
    });

    let lines: string[] = [];
    if (targetZona) {
      lines = computation.cuadrosByZone[targetZona]?.txtLines || [];
    } else {
      for (const z of Object.keys(computation.cuadrosByZone)) {
        lines.push(...computation.cuadrosByZone[z].txtLines);
      }
    }

    const txtContent = lines.length > 0 ? lines.join('\n') + '\n' : '';

    const filenameZona = targetZona
      ? normalizeAsciiUpper(targetZona).replace(/[^A-Z0-9]/g, '')
      : 'Global';
    const rateSuffix = targetRateBucket !== '5.11' ? `_Tipo${targetRateBucket.replace('.', '_')}` : '';
    const modeSuffix = mode === 'neteado' ? '_Contingencia' : '';

    const response = new NextResponse(txtContent);
    response.headers.set('Content-Type', 'text/plain; charset=utf-8');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename=Desglose_560_${filenameZona}_${year}_T${quarter}${rateSuffix}${modeSuffix}.txt`
    );
    return response;
  } catch (error: any) {
    console.error('Error exportando AEAT TXT:', error);
    return NextResponse.json({ error: error.message || 'Error exportando TXT' }, { status: 500 });
  }
}
