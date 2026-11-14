import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveBrand } from '@/lib/permissions';
import { pickSpanishPostalCode } from '@/lib/postalCode';
import {
  canonicalProvince,
  getDateRangeMadridBounds,
  isPenaltyInvoiceRecord,
  matchesMunicipality,
  normalizeAsciiUpper,
  parseTaxNum,
  round2,
  round3,
} from '@/lib/taxUtils';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as string | undefined;
    if (userRole && !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole)) {
      return NextResponse.json({ error: 'Permisos insuficientes para consulta tributaria' }, { status: 403 });
    }

    const activeBrandId = await getActiveBrand(session.user);
    if (!activeBrandId) {
      return NextResponse.json({ error: 'No hay marca activa seleccionada' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const municipalityQuery = searchParams.get('postalCode'); // Formato "Municipio -- Provincia" o "Municipio"
    const scope = searchParams.get('scope') === 'company' ? 'company' : 'brand';

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate y endDate son obligatorios' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
      select: { id: true, name: true, companyId: true },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    const clientWhere =
      scope === 'company' && brand.companyId
        ? { brand: { companyId: brand.companyId } }
        : { brandId: activeBrandId };

    const { startDate, endDate } = getDateRangeMadridBounds(startDateParam, endDateParam);

    const invoiceSelect = {
      id: true,
      pdfUrl: true,
      issueDate: true,
      billingStart: true,
      billingEnd: true,
      invoiceNumber: true,
      invoiceType: true,
      taxAmount: true,
      totalMWh: true,
      subtotal1: true,
      origin: true,
      invoiceData: true,
      client: { select: { vatNumber: true } },
      supplyPoint: {
        select: {
          cups: true,
          city: true,
          province: true,
          tariff: true,
          postalCode: true,
          sipsPostalCode: true,
          distributor: true,
          distributorName: true,
        },
      },
    } as const;

    let invoices: any[] = [];

    // OPTIMIZACIÓN HÍBRIDA SIN PÉRDIDA DE DATOS (Regla 84 + Sección 3.2 GUIA_IMPUESTOS):
    // Pre-filtramos los SupplyPoints que encajan con el municipio, pero incluimos también aquellos
    // sin 'city' informada (o facturas con supplyPointId = null) para respetar el fallback a invoiceData['POBLACION PS'].
    if (municipalityQuery) {
      const sps = await prisma.supplyPoint.findMany({
        where: { client: clientWhere },
        select: { id: true, city: true, province: true },
      });

      const candidateSpIds: string[] = [];
      for (const sp of sps) {
        if (!sp.city || !sp.city.trim()) {
          candidateSpIds.push(sp.id);
        } else if (matchesMunicipality(sp.city, sp.province, municipalityQuery)) {
          candidateSpIds.push(sp.id);
        }
      }

      invoices = await prisma.invoice.findMany({
        where: {
          client: clientWhere,
          issueDate: { gte: startDate, lte: endDate },
          OR: [
            ...(candidateSpIds.length > 0 ? [{ supplyPointId: { in: candidateSpIds } }] : []),
            { supplyPointId: null },
          ],
        },
        select: invoiceSelect,
        orderBy: { issueDate: 'asc' },
      });
    } else {
      invoices = await prisma.invoice.findMany({
        where: {
          client: clientWhere,
          issueDate: { gte: startDate, lte: endDate },
        },
        select: invoiceSelect,
        orderBy: { issueDate: 'asc' },
      });
    }

    // Deduplicar por invoiceNumber (Regla 82), excluir penalizaciones y aplicar filtro fino en memoria
    const seenInvoices = new Set<string>();
    const filteredInvoices: any[] = [];

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }

      const data = (inv.invoiceData as Record<string, any> | null) || {};
      if (isPenaltyInvoiceRecord(inv, data)) continue;

      if (municipalityQuery) {
        const rawCity =
          inv.supplyPoint?.city ||
          data['POBLACION PS'] ||
          data['Poblacion PS'] ||
          data['Población PS'] ||
          null;
        const rawProv =
          inv.supplyPoint?.province ||
          data['PROVINCIA PS'] ||
          data['Provincia PS'] ||
          null;

        if (!matchesMunicipality(rawCity ? String(rawCity) : null, rawProv ? String(rawProv) : null, municipalityQuery)) {
          continue;
        }
      }

      filteredInvoices.push(inv);
    }

    const extractTasaComponents = (inv: any) => {
      const data = (inv.invoiceData as Record<string, any> | null) || {};
      const isAbono =
        String(inv.invoiceType || data['Tipo Factura'] || '').toLowerCase().includes('abono') ||
        String(inv.invoiceNumber || '').toUpperCase().startsWith('AB-');

      let baseIVA =
        data['Base Imponible IVA CORR'] !== undefined
          ? parseTaxNum(data['Base Imponible IVA CORR'])
          : data['Base Imponible IVA'] !== undefined
            ? parseTaxNum(data['Base Imponible IVA'])
            : inv.origin === 'INTERNAL_ENGINE' && data['totalBase'] !== undefined
              ? parseTaxNum(data['totalBase'])
              : parseTaxNum(inv.subtotal1);

      let bonoSocial = parseTaxNum(data['Importe Bono Social'] ?? data['bonoSocial']);

      let impuestoElectrico =
        data['Importe Impuesto CORR'] !== undefined
          ? parseTaxNum(data['Importe Impuesto CORR'])
          : data['Importe Impuesto'] !== undefined
            ? parseTaxNum(data['Importe Impuesto'])
            : data['taxElectric'] !== undefined
              ? parseTaxNum(data['taxElectric'])
              : inv.origin === 'INTERNAL_ENGINE'
                ? 0
                : parseTaxNum(inv.taxAmount);

      let baseF1 =
        data['BaseImponibleF1 CORR'] !== undefined
          ? parseTaxNum(data['BaseImponibleF1 CORR'])
          : parseTaxNum(data['BaseImponibleF1']);

      // Excluir SVA separables (Art. 24.1.c TRLRHL: ingresos ajenos al suministro eléctrico)
      let svaSeparable =
        parseTaxNum(data['Importe SVA'] ?? data['svaCost']) +
        parseTaxNum(data['cgBolsilloSolarCost']);

      let energiaKwh =
        data['Cantidad Energía Total Consumida CORR'] !== undefined
          ? parseTaxNum(data['Cantidad Energía Total Consumida CORR'])
          : data['Energía Total Consumida'] !== undefined
            ? parseTaxNum(data['Energía Total Consumida'])
            : parseTaxNum(inv.totalMWh);

      let baseImponibleFactura =
        data['BI Subtotal 1 CORR'] !== undefined
          ? parseTaxNum(data['BI Subtotal 1 CORR'])
          : data['Subtotal 1'] !== undefined
            ? parseTaxNum(data['Subtotal 1'])
            : parseTaxNum(inv.subtotal1);

      if (isAbono) {
        if (baseIVA > 0) baseIVA = -baseIVA;
        if (bonoSocial > 0) bonoSocial = -bonoSocial;
        if (impuestoElectrico > 0) impuestoElectrico = -impuestoElectrico;
        if (baseF1 > 0) baseF1 = -baseF1;
        if (svaSeparable > 0) svaSeparable = -svaSeparable;
        if (energiaKwh > 0) energiaKwh = -energiaKwh;
        if (baseImponibleFactura > 0) baseImponibleFactura = -baseImponibleFactura;
      }

      baseIVA = round2(baseIVA);
      bonoSocial = round2(bonoSocial);
      impuestoElectrico = round2(impuestoElectrico);
      baseF1 = round2(baseF1);
      svaSeparable = round2(svaSeparable);
      baseImponibleFactura = round2(baseImponibleFactura);

      // Conversión de kWh (Regla 81) a MWh reales
      const energiaMwh = round3(energiaKwh / 1000.0);

      const baseTasaMunicipal = round2(baseIVA - bonoSocial - impuestoElectrico - baseF1 - svaSeparable);
      const tasaMunicipal = round2(baseTasaMunicipal * 0.015);

      return {
        data,
        baseIVA,
        bonoSocial,
        impuestoElectrico,
        baseF1,
        svaSeparable,
        energiaMwh,
        baseImponibleFactura,
        baseTasaMunicipal,
        tasaMunicipal,
      };
    };

    let totalBaseGlobal = 0;
    let totalTasaGlobal = 0;

    if (municipalityQuery) {
      const detailedResults = filteredInvoices.map((inv) => {
        const c = extractTasaComponents(inv);
        totalBaseGlobal = round2(totalBaseGlobal + c.baseTasaMunicipal);
        totalTasaGlobal = round2(totalTasaGlobal + c.tasaMunicipal);

        return {
          id: inv.id,
          pdfUrl: inv.pdfUrl,
          issueDate: inv.issueDate,
          billingStart: inv.billingStart,
          billingEnd: inv.billingEnd,
          cups: inv.supplyPoint?.cups || String(c.data['CUPS'] || ''),
          distribuidora:
            inv.supplyPoint?.distributorName ||
            inv.supplyPoint?.distributor ||
            String(c.data['Distribuidora'] || ''),
          nifCliente: inv.client?.vatNumber || String(c.data['NIF Cliente'] || ''),
          invoiceNumber: inv.invoiceNumber,
          codigoFiscal: String(c.data['Codigo Fiscal'] || ''),
          invoiceType: inv.invoiceType || 'Normal',
          tariff: inv.supplyPoint?.tariff || String(c.data['Tarifa'] || ''),
          postalCode: pickSpanishPostalCode(
            c.data['CP PS'],
            inv.supplyPoint?.postalCode,
            inv.supplyPoint?.sipsPostalCode
          ),
          energiaConsumida: c.energiaMwh,
          importeIVA: c.baseIVA,
          baseImponibleFactura: c.baseImponibleFactura,
          baseImponibleF1: c.baseF1,
          importeImpuesto: c.impuestoElectrico,
          importeBonoSocial: c.bonoSocial,
          importeSVA: c.svaSeparable,
          baseImponibleTasaMunicipal: c.baseTasaMunicipal,
          tasaMunicipal: c.tasaMunicipal,
        };
      });

      return NextResponse.json({
        type: 'detailed',
        results: detailedResults,
        totalBaseGlobal: round2(totalBaseGlobal),
        totalTasaGlobal: round2(totalTasaGlobal),
      });
    } else {
      const groupedMap = new Map<string, { cp: string; poblacion: string; provincia: string; base: number; tasa: number }>();

      for (const inv of filteredInvoices) {
        const c = extractTasaComponents(inv);
        const sp = inv.supplyPoint;

        const cp =
          pickSpanishPostalCode(
            c.data['CP PS'],
            sp?.postalCode,
            sp?.sipsPostalCode
          ) || 'Desconocido';
        const rawCityFromData =
          c.data['POBLACION PS'] || c.data['Poblacion PS'] || c.data['Población PS'] || null;
        const rawPoblacion = String(sp?.city || rawCityFromData || 'Desconocido').trim();
        const rawProvincia = String(
          sp?.province || c.data['PROVINCIA PS'] || c.data['Provincia PS'] || ''
        ).trim();

        const normalizedCity = normalizeAsciiUpper(rawPoblacion).replace(/['’`´]/g, '') || 'DESCONOCIDO';
        const normProv = canonicalProvince(rawProvincia) || (cp !== 'Desconocido' ? cp.substring(0, 2) : '');
        const groupKey = `${normalizedCity}|${normProv}`;

        if (!groupedMap.has(groupKey)) {
          groupedMap.set(groupKey, {
            cp,
            poblacion: rawPoblacion.toUpperCase(),
            provincia: rawProvincia.toUpperCase(),
            base: 0,
            tasa: 0,
          });
        }

        const group = groupedMap.get(groupKey)!;
        group.base = round2(group.base + c.baseTasaMunicipal);
        group.tasa = round2(group.tasa + c.tasaMunicipal);

        totalBaseGlobal = round2(totalBaseGlobal + c.baseTasaMunicipal);
        totalTasaGlobal = round2(totalTasaGlobal + c.tasaMunicipal);
      }

      const groupedResults = Array.from(groupedMap.values()).sort((a, b) =>
        a.poblacion.localeCompare(b.poblacion)
      );

      return NextResponse.json({
        type: 'grouped',
        results: groupedResults,
        totalBaseGlobal: round2(totalBaseGlobal),
        totalTasaGlobal: round2(totalTasaGlobal),
      });
    }
  } catch (error) {
    console.error('Error calculating Tasa Municipal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
