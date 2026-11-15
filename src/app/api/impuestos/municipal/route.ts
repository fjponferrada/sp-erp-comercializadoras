import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveBrand } from '@/lib/permissions';
import {
  getIneCatalog,
  resolveCanonicalMunicipalitySync,
  resolveTargetGroupKeys,
} from '@/lib/municipalityResolver';
import {
  getDateRangeMadridBounds,
  isPenaltyInvoiceRecord,
  matchesMunicipality,
  normalizeAsciiUpper,
  parseTaxNum,
  round2,
  round3,
} from '@/lib/taxUtils';

function resolveValidCloudPdfUrl(invPdfUrl: string | null | undefined, data: Record<string, any>): string | null {
  const candidates = [invPdfUrl, data?.output_pdf, data?.pdfUrl, typeof data?.PDF === 'string' ? data.PDF : null];
  for (const cand of candidates) {
    if (
      typeof cand === 'string' &&
      (cand.startsWith('https://') || cand.startsWith('http://')) &&
      !cand.includes('airtable')
    ) {
      return cand;
    }
  }
  return null;
}

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
    const explicitGroupKey = searchParams.get('groupKey'); // Ej. "INE:14007" o "RAW:DESCONOCIDO|XX" (drill-down directo)
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

    const catalog = await getIneCatalog();
    const targetGroupKeys = resolveTargetGroupKeys(catalog, municipalityQuery, explicitGroupKey);
    const isSpecificMode = Boolean(explicitGroupKey || municipalityQuery);

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
      f1Invoice: { select: { baseImponible: true } },
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

    // OPTIMIZACIÓN HÍBRIDA SIN PÉRDIDA DE DATOS (Regla 84 + Regla 220):
    // Pre-filtramos usando el mismo resolutor canónico INE (incluyendo pedanías por CP),
    // manteniendo además suministros sin city/CP informados o facturas con supplyPointId = null
    // para respetar el fallback a invoiceData['POBLACION PS'] / invoiceData['CP PS'].
    if (isSpecificMode) {
      const sps = await prisma.supplyPoint.findMany({
        where: { client: clientWhere },
        select: { id: true, city: true, province: true, postalCode: true, sipsPostalCode: true },
      });

      const candidateSpIds: string[] = [];
      for (const sp of sps) {
        if (!sp.city || !sp.city.trim() || (!sp.postalCode && !sp.sipsPostalCode)) {
          candidateSpIds.push(sp.id);
          continue;
        }
        const resolvedSp = resolveCanonicalMunicipalitySync(catalog, {
          rawCity: sp.city,
          rawProvince: sp.province,
          postalCode: sp.postalCode,
          sipsPostalCode: sp.sipsPostalCode,
        });
        if (targetGroupKeys && targetGroupKeys.has(resolvedSp.groupKey)) {
          candidateSpIds.push(sp.id);
        } else if (municipalityQuery && matchesMunicipality(sp.city, sp.province, municipalityQuery)) {
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

    // Deduplicar por invoiceNumber (Regla 82), excluir penalizaciones y resolver Ayuntamiento canónico INE
    const seenInvoices = new Set<string>();
    const filteredEntries: Array<{ inv: any; resolvedMuni: ReturnType<typeof resolveCanonicalMunicipalitySync> }> = [];

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }

      const data = (inv.invoiceData as Record<string, any> | null) || {};
      if (isPenaltyInvoiceRecord(inv, data)) continue;

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

      const resolvedMuni = resolveCanonicalMunicipalitySync(catalog, {
        rawCity: rawCity ? String(rawCity) : null,
        rawProvince: rawProv ? String(rawProv) : null,
        postalCode: inv.supplyPoint?.postalCode,
        sipsPostalCode: inv.supplyPoint?.sipsPostalCode,
        invoiceCpPs: data['CP PS'],
      });

      if (isSpecificMode) {
        const matchesByKey = Boolean(targetGroupKeys && targetGroupKeys.has(resolvedMuni.groupKey));
        const matchesByText = Boolean(
          !explicitGroupKey &&
            municipalityQuery &&
            matchesMunicipality(rawCity ? String(rawCity) : null, rawProv ? String(rawProv) : null, municipalityQuery)
        );
        if (!matchesByKey && !matchesByText) {
          continue;
        }
      }

      filteredEntries.push({ inv, resolvedMuni });
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

      let bonoSocial =
        data['Importe Bono Social CORR'] !== undefined
          ? parseTaxNum(data['Importe Bono Social CORR'])
          : parseTaxNum(data['Importe Bono Social'] ?? data['bonoSocial']);

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

      let baseImponibleFactura =
        data['BI Subtotal 1 CORR'] !== undefined
          ? parseTaxNum(data['BI Subtotal 1 CORR'])
          : data['Subtotal 1'] !== undefined
            ? parseTaxNum(data['Subtotal 1'])
            : parseTaxNum(inv.subtotal1);

      let baseF1 =
        data['BaseImponibleF1 CORR'] !== undefined
          ? parseTaxNum(data['BaseImponibleF1 CORR'])
          : parseTaxNum(data['BaseImponibleF1']);

      // Facturas pass-through de Derechos de Contratación / Actuaciones en la medida de distribuidora
      // donde los CSV 2025/2026 dejan BaseImponibleF1 nulo pero informan Concepto Repercutible / Base Imponible Fichero
      if (baseF1 === 0) {
        const motivoNorm = normalizeAsciiUpper(String(data['Motivo Factura'] || data['MotivoFacturacion'] || ''));
        const conceptoRepercutible = parseTaxNum(data['Concepto Repercutible']);
        if (
          motivoNorm.includes('DERECHOS DE CONTRATACION') ||
          (conceptoRepercutible !== 0 && Math.abs(baseImponibleFactura) < 0.01)
        ) {
          baseF1 =
            conceptoRepercutible ||
            parseTaxNum(data['Base Imponible Fichero']) ||
            parseTaxNum(inv.f1Invoice?.baseImponible);
        }
      }

      // Excluir SVA separables y Costes de Gestión de Bolsillo Solar (Art. 24.1.c TRLRHL)
      // Claves reales en CSV/Ingebau: 'Total SVA' y 'Costes de Gestion Bolsillo Solar'
      // Claves en motor interno: 'Importe SVA' / 'svaCost' y 'cgBolsilloSolarCost'
      const svaGeneral = parseTaxNum(data['Total SVA'] ?? data['Importe SVA'] ?? data['svaCost']);
      const svaBolsillo = parseTaxNum(
        data['Costes de Gestion Bolsillo Solar'] ??
          data['Costes de Gestión Bolsillo Solar'] ??
          data['cgBolsilloSolarCost']
      );
      let svaSeparable = svaGeneral + svaBolsillo;

      let energiaKwh =
        data['Cantidad Energía Total Consumida CORR'] !== undefined
          ? parseTaxNum(data['Cantidad Energía Total Consumida CORR'])
          : data['Energía Total Consumida'] !== undefined
            ? parseTaxNum(data['Energía Total Consumida'])
            : parseTaxNum(inv.totalMWh);

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

      // Salvaguarda para facturas históricas sin suministro donde el SVA ya fue absorbido dentro de BaseImponibleF1
      if (
        svaSeparable !== 0 &&
        Math.abs(baseImponibleFactura) < 0.01 &&
        Math.abs(baseIVA - bonoSocial - impuestoElectrico - baseF1) < 0.02
      ) {
        svaSeparable = 0;
      }

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
    let totalEnergiaGlobal = 0;

    if (isSpecificMode) {
      let resolvedMunicipalityLabel = municipalityQuery || '';
      const detailedResults = filteredEntries.map(({ inv, resolvedMuni }) => {
        const c = extractTasaComponents(inv);
        totalBaseGlobal = round2(totalBaseGlobal + c.baseTasaMunicipal);
        totalTasaGlobal = round2(totalTasaGlobal + c.tasaMunicipal);
        totalEnergiaGlobal = round3(totalEnergiaGlobal + c.energiaMwh);

        if (!resolvedMunicipalityLabel || explicitGroupKey) {
          resolvedMunicipalityLabel = resolvedMuni.provincia
            ? `${resolvedMuni.poblacion} (${resolvedMuni.provincia})`
            : resolvedMuni.poblacion;
        }

        return {
          id: inv.id,
          pdfUrl: resolveValidCloudPdfUrl(inv.pdfUrl, c.data),
          issueDate: inv.issueDate,
          billingStart: inv.billingStart,
          billingEnd: inv.billingEnd,
          cups: inv.supplyPoint?.cups || String(c.data['CUPS'] || ''),
          distribuidora:
            inv.supplyPoint?.distributorName ||
            inv.supplyPoint?.distributor ||
            String(c.data['DISTRIBUIDORA'] || c.data['Distribuidora'] || ''),
          nifCliente: inv.client?.vatNumber || String(c.data['CIF'] || c.data['NIF Cliente'] || ''),
          invoiceNumber: inv.invoiceNumber,
          codigoFiscal: String(c.data['Codigo Fiscal'] || ''),
          invoiceType: inv.invoiceType || String(c.data['Tipo Factura'] || 'Normal'),
          tariff: inv.supplyPoint?.tariff || String(c.data['Tarifa ATR'] || c.data['Tarifa'] || ''),
          postalCode: resolvedMuni.cp !== 'Desconocido' ? resolvedMuni.cp : '',
          poblacion: resolvedMuni.poblacion,
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
        municipalityLabel: resolvedMunicipalityLabel,
        results: detailedResults,
        totalInvoicesGlobal: detailedResults.length,
        totalEnergiaGlobal: round3(totalEnergiaGlobal),
        totalBaseGlobal: round2(totalBaseGlobal),
        totalTasaGlobal: round2(totalTasaGlobal),
      });
    } else {
      const groupedMap = new Map<
        string,
        {
          groupKey: string;
          ineCode: string | null;
          cps: Set<string>;
          poblacion: string;
          provincia: string;
          queryValue: string;
          invoiceCount: number;
          energiaConsumida: number;
          base: number;
          tasa: number;
        }
      >();

      for (const { inv, resolvedMuni } of filteredEntries) {
        const c = extractTasaComponents(inv);
        const { groupKey, ineCode, poblacion, provincia, cp, isOfficialIne } = resolvedMuni;

        if (!groupedMap.has(groupKey)) {
          const officialEntry = ineCode ? catalog.byCode.get(ineCode) : null;
          const queryValue = officialEntry
            ? `${officialEntry.name} -- ${officialEntry.provName}`
            : isOfficialIne && provincia
              ? `${poblacion} -- ${provincia}`
              : '';

          groupedMap.set(groupKey, {
            groupKey,
            ineCode,
            cps: new Set<string>(),
            poblacion,
            provincia,
            queryValue,
            invoiceCount: 0,
            energiaConsumida: 0,
            base: 0,
            tasa: 0,
          });
        }

        const group = groupedMap.get(groupKey)!;
        if (cp && cp !== 'Desconocido') {
          group.cps.add(cp);
        }
        group.invoiceCount += 1;
        group.energiaConsumida = round3(group.energiaConsumida + c.energiaMwh);
        group.base = round2(group.base + c.baseTasaMunicipal);
        group.tasa = round2(group.tasa + c.tasaMunicipal);

        totalEnergiaGlobal = round3(totalEnergiaGlobal + c.energiaMwh);
        totalBaseGlobal = round2(totalBaseGlobal + c.baseTasaMunicipal);
        totalTasaGlobal = round2(totalTasaGlobal + c.tasaMunicipal);
      }

      const groupedResults = Array.from(groupedMap.values())
        .map((g) => {
          const sortedCps = Array.from(g.cps).sort();
          const primaryCp = sortedCps[0] || 'Desconocido';
          const cpDisplay =
            sortedCps.length <= 1 ? primaryCp : `${primaryCp} (+${sortedCps.length - 1} CPs)`;

          return {
            groupKey: g.groupKey,
            ineCode: g.ineCode,
            cp: cpDisplay,
            cpList: sortedCps.join(', ') || 'Desconocido',
            poblacion: g.poblacion,
            provincia: g.provincia,
            queryValue: g.queryValue,
            invoiceCount: g.invoiceCount,
            energiaConsumida: g.energiaConsumida,
            base: g.base,
            tasa: g.tasa,
          };
        })
        .sort((a, b) => a.poblacion.localeCompare(b.poblacion, 'es'));

      return NextResponse.json({
        type: 'grouped',
        results: groupedResults,
        totalInvoicesGlobal: filteredEntries.length,
        totalEnergiaGlobal: round3(totalEnergiaGlobal),
        totalBaseGlobal: round2(totalBaseGlobal),
        totalTasaGlobal: round2(totalTasaGlobal),
      });
    }
  } catch (error) {
    console.error('Error calculating Tasa Municipal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
