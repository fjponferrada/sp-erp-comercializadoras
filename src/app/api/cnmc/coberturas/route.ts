import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  calculatePpaHourlyMwh,
  getClockHourOccurrencesInMonth,
  getDaysInCalendarMonth,
} from '@/lib/ppaEngine';
import { mergeDailyReganecuRecords } from '@/lib/reganecuServer';
import {
  logRegulatoryGeneration,
  requireRegulatoryContext,
} from '@/lib/regulacionServer';

const CIERRE_ORDER = ['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'A4', 'C4', 'A5', 'C5'];

function getCierreRank(cierre: string): number {
  return CIERRE_ORDER.indexOf((cierre || '').toUpperCase().trim());
}

function isIndexedContractOrProduct(contract?: {
  pricingModel?: string | null;
  product?: { pricingModel?: string | null; type?: string | null; name?: string | null } | null;
} | null): boolean {
  if (!contract) return false;
  const pm = (contract.pricingModel || contract.product?.pricingModel || '').toUpperCase();
  if (pm === 'INDEXED' || pm === 'INDEXADO') return true;
  const pType = (contract.product?.type || '').toLowerCase();
  const pName = (contract.product?.name || '').toLowerCase();
  return (
    pType.includes('pass-through') ||
    pType.includes('index') ||
    pName.includes('indexad') ||
    pName.includes('pass-through')
  );
}

function computeAnnualPpaMwh(ppa: any, year: number): number {
  let totalMwh = 0;
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = getDaysInCalendarMonth(year, m);
    const occ = getClockHourOccurrencesInMonth(year, m);
    for (let d = 1; d <= daysInMonth; d++) {
      // En DST: último domingo de marzo salta hora 02, último domingo de octubre duplica hora 02
      const mar31Dow = new Date(Date.UTC(year, 2, 31)).getUTCDay();
      const dstStartDay = 31 - mar31Dow;
      const oct31Dow = new Date(Date.UTC(year, 9, 31)).getUTCDay();
      const dstEndDay = 31 - oct31Dow;

      for (let h = 0; h < 24; h++) {
        if (m === 3 && d === dstStartDay && h === 2) continue;
        const mwh = calculatePpaHourlyMwh(ppa, year, m, d, h, occ);
        totalMwh += mwh;
        if (m === 10 && d === dstEndDay && h === 2) {
          totalMwh += mwh; // Hora 02B repetida
        }
      }
    }
  }
  return totalMwh;
}

export async function GET(request: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '', 10);
    const isPreview = searchParams.get('preview') === 'true';

    if (!Number.isFinite(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        { error: 'Año inválido para el reporte de Coberturas CNMC.' },
        { status: 400 }
      );
    }

    const startUtc = new Date(`${year}-01-01T00:00:00.000Z`);
    const endUtc = new Date(`${year}-12-31T23:59:59.999Z`);

    const [ppas, reganecuRecords, pendingSummaries, invoices, internalInvoices] = await Promise.all([
      prisma.ppa.findMany({
        where: { companyId: ctx.companyId },
      }),
      prisma.reganecuData.findMany({
        where: {
          companyId: ctx.companyId,
          date: { gte: startUtc, lte: endUtc },
          total: true,
          matricial: false,
        },
      }),
      prisma.pendingEnergySummary.findMany({
        where: {
          companyId: ctx.companyId,
          month: { startsWith: `${year}-` },
        },
      }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { companyId: ctx.companyId },
            { companyId: null, client: { brand: { companyId: ctx.companyId } } },
          ],
          billingEnd: { gte: startUtc, lte: endUtc },
        },
        select: {
          id: true,
          invoiceNumber: true,
          f1InvoiceId: true,
          invoiceType: true,
          totalAmount: true,
          totalMWh: true,
          supplyPoint: { select: { tariff: true } },
          contract: {
            select: {
              pricingModel: true,
              product: { select: { pricingModel: true, type: true, name: true } },
            },
          },
        },
      }),
      prisma.internalInvoice.findMany({
        where: {
          OR: [
            { companyId: ctx.companyId },
            { companyId: null, client: { brand: { companyId: ctx.companyId } } },
          ],
          status: { in: ['EMITIDA', 'ABONO'] },
          hidden: false,
          billingEnd: { gte: startUtc, lte: endUtc },
        },
        select: {
          id: true,
          invoiceNumber: true,
          f1InvoiceId: true,
          status: true,
          invoiceType: true,
          totalAmount: true,
          totalMWh: true,
          supplyPoint: { select: { tariff: true } },
          contract: {
            select: {
              pricingModel: true,
              product: { select: { pricingModel: true, type: true, name: true } },
            },
          },
        },
      }),
    ]);

    // 1. Calcular energía cubierta a partir de PPAs/Coberturas (en kWh BC)
    let c2IntragrupoNuclear = 0;
    let c3IntragrupoHidraulica = 0;
    let c4IntragrupoResto = 0;
    let c5PlazoCCC = 0;
    let c6PlazoNoCCC = 0;
    let c7OtrosCCC = 0;
    let c8OtrosNoCCC = 0;

    const ppaBreakdown: Array<{ name: string; subtype: string; priceType: string; bucket: string; kwh: number }> = [];

    for (const ppa of ppas) {
      // Solo contratos con cobertura de precio (no indexados puros al mercado diario)
      if (ppa.priceType === 'INDEXADO') continue;

      const annualMwh = computeAnnualPpaMwh(ppa, year);
      if (annualMwh <= 0) continue;
      const kwh = Math.round(annualMwh * 1000);

      const metaText = `${ppa.name} ${ppa.counterparty || ''} ${ppa.notes || ''}`.toUpperCase();
      const isIntragrupo = metaText.includes('INTRAGRUPO');
      const isCCC =
        metaText.includes('OMIP') ||
        metaText.includes('MEFF') ||
        metaText.includes('EEX') ||
        metaText.includes('CCC') ||
        metaText.includes('CAMARA') ||
        metaText.includes('CÁMARA');

      let bucket = 'energiaCubiertaAPlazoNoCCC';
      if (isIntragrupo) {
        if (metaText.includes('NUCLEAR')) {
          c2IntragrupoNuclear += kwh;
          bucket = 'energiaCubiertaIntragrupoNuclear';
        } else if (metaText.includes('HIDRAUL') || metaText.includes('HIDRÁUL')) {
          c3IntragrupoHidraulica += kwh;
          bucket = 'energiaCubiertaIntragrupoHidraulica';
        } else {
          c4IntragrupoResto += kwh;
          bucket = 'energiaCubiertaIntragrupoResto';
        }
      } else if (ppa.subtype === 'CARGA_BASE') {
        if (isCCC) {
          c5PlazoCCC += kwh;
          bucket = 'energiaCubiertaAPlazoCCC';
        } else {
          c6PlazoNoCCC += kwh;
          bucket = 'energiaCubiertaAPlazoNoCCC';
        }
      } else {
        if (isCCC) {
          c7OtrosCCC += kwh;
          bucket = 'energiaCubiertaOtrosCCC';
        } else {
          c8OtrosNoCCC += kwh;
          bucket = 'energiaCubiertaOtrosNoCCC';
        }
      }

      ppaBreakdown.push({
        name: ppa.name,
        subtype: ppa.subtype,
        priceType: ppa.priceType,
        bucket,
        kwh,
      });
    }

    // 2. Calcular energía suministrada en Barras de Central (BC) en kWh (Campo 9)
    // Prioridad: REGANECU último cierre por mes (concepto CAD) -> PendingEnergySummary.estimatedBcMwh -> Facturado + pérdidas
    const reganecuByMonth = new Map<string, { cierre: string; rank: number; recs: any[] }>();
    for (const rec of reganecuRecords) {
      const mKey = rec.date.toISOString().slice(0, 7); // YYYY-MM
      const rank = getCierreRank(rec.cierre);
      const curr = reganecuByMonth.get(mKey);
      if (!curr || rank > curr.rank) {
        reganecuByMonth.set(mKey, { cierre: rec.cierre, rank, recs: [rec] });
      } else if (rank === curr.rank) {
        curr.recs.push(rec);
      }
    }

    const pendingByMonth = new Map<string, number>();
    for (const ps of pendingSummaries) {
      pendingByMonth.set(ps.month, ps.liquidatedMwh > 0 ? ps.liquidatedMwh : ps.estimatedBcMwh);
    }

    let bcMwhFromReganecuOrSummary = 0;
    let monthsCoveredBySettlement = 0;

    for (let m = 1; m <= 12; m++) {
      const mKey = `${year}-${String(m).padStart(2, '0')}`;
      const regMonth = reganecuByMonth.get(mKey);
      if (regMonth && regMonth.recs.length > 0) {
        const mergedDays = mergeDailyReganecuRecords(regMonth.recs, false);
        let monthCadMwh = 0;
        for (const dayRec of mergedDays) {
          const jData = (dayRec.jsonData || {}) as Record<string, any>;
          const cad = jData['CAD'];
          if (cad) {
            monthCadMwh += (cad.energyVentas || 0) + (cad.energyCompras || 0);
          }
        }
        if (monthCadMwh > 0) {
          bcMwhFromReganecuOrSummary += monthCadMwh;
          monthsCoveredBySettlement++;
          continue;
        }
      }

      const summaryMwh = pendingByMonth.get(mKey);
      if (summaryMwh && summaryMwh > 0) {
        bcMwhFromReganecuOrSummary += summaryMwh;
        monthsCoveredBySettlement++;
      }
    }

    // 3. Consolidar facturación para proporción Fijo vs Indexado (y respaldo de BC si no hay REGANECU)
    const seenF1Ids = new Set<string>();
    const seenInvNumbers = new Set<string>();

    let fixedInvoicedMwh = 0;
    let indexedInvoicedMwh = 0;
    let estimatedBcFromInvoicesMwh = 0;

    const normalizeSignedMwh = (mwh: number, totalAmount: number, invType?: string | null, isAbonoStatus = false) => {
      const t = (invType || '').toUpperCase();
      const isAbono = isAbonoStatus || t === 'A' || t === 'AR' || t === 'S' || t === 'R_NEG' || totalAmount < 0;
      if (isAbono && mwh > 0 && totalAmount < 0) return -mwh;
      return mwh;
    };

    const lossFactorForTariff = (tariff?: string | null) => {
      const t = (tariff || '').toUpperCase();
      if (t.includes('6.')) return 1.055;
      if (t.includes('3.0')) return 1.095;
      return 1.135; // 2.0TD media pérdidas BT
    };

    for (const inv of invoices) {
      if (inv.f1InvoiceId) seenF1Ids.add(inv.f1InvoiceId);
      if (inv.invoiceNumber) seenInvNumbers.add(inv.invoiceNumber);

      const signedMwh = normalizeSignedMwh(inv.totalMWh || 0, inv.totalAmount || 0, inv.invoiceType);
      if (isIndexedContractOrProduct(inv.contract)) {
        indexedInvoicedMwh += signedMwh;
      } else {
        fixedInvoicedMwh += signedMwh;
      }
      estimatedBcFromInvoicesMwh += signedMwh * lossFactorForTariff(inv.supplyPoint?.tariff);
    }

    for (const iInv of internalInvoices) {
      if (iInv.f1InvoiceId && seenF1Ids.has(iInv.f1InvoiceId)) continue;
      if (iInv.invoiceNumber && seenInvNumbers.has(iInv.invoiceNumber)) continue;

      const signedMwh = normalizeSignedMwh(
        iInv.totalMWh || 0,
        iInv.totalAmount || 0,
        iInv.invoiceType,
        iInv.status === 'ABONO'
      );
      if (isIndexedContractOrProduct(iInv.contract)) {
        indexedInvoicedMwh += signedMwh;
      } else {
        fixedInvoicedMwh += signedMwh;
      }
      estimatedBcFromInvoicesMwh += signedMwh * lossFactorForTariff(iInv.supplyPoint?.tariff);
    }

    const totalInvoicedMwh = Math.max(0, fixedInvoicedMwh + indexedInvoicedMwh);
    const fixedShare =
      totalInvoicedMwh > 0
        ? Math.min(1, Math.max(0, Math.max(0, fixedInvoicedMwh) / totalInvoicedMwh))
        : 0;

    const autoSuministradaKwh = Math.max(
      0,
      Math.round(
        (monthsCoveredBySettlement === 12 && bcMwhFromReganecuOrSummary > 0
          ? bcMwhFromReganecuOrSummary
          : Math.max(bcMwhFromReganecuOrSummary, estimatedBcFromInvoicesMwh)) * 1000
      )
    );

    const autoNoIndexadaKwh = Math.round(autoSuministradaKwh * fixedShare);

    // Permitir ajuste explícito de cualquiera de los campos numéricos 2..10 desde el validador UI
    const parseOverride = (paramName: string, autoVal: number): number => {
      const raw = searchParams.get(paramName);
      if (raw === null || raw === undefined || raw.trim() === '') return autoVal;
      const n = Math.round(Number(raw));
      return Number.isFinite(n) ? n : autoVal;
    };

    const fields = {
      codigoComercializador: ctx.codigoAgente,
      energiaCubiertaIntragrupoNuclear: parseOverride('c2', c2IntragrupoNuclear),
      energiaCubiertaIntragrupoHidraulica: parseOverride('c3', c3IntragrupoHidraulica),
      energiaCubiertaIntragrupoResto: parseOverride('c4', c4IntragrupoResto),
      energiaCubiertaAPlazoCCC: parseOverride('c5', c5PlazoCCC),
      energiaCubiertaAPlazoNoCCC: parseOverride('c6', c6PlazoNoCCC),
      energiaCubiertaOtrosCCC: parseOverride('c7', c7OtrosCCC),
      energiaCubiertaOtrosNoCCC: parseOverride('c8', c8OtrosNoCCC),
      energiaSuministrada: parseOverride('c9', autoSuministradaKwh),
      energiaSuministradaPrecioNoIndexadoMD: parseOverride('c10', autoNoIndexadaKwh),
    };

    const warnings: string[] = [];
    if (monthsCoveredBySettlement < 12) {
      warnings.push(
        `Se dispone de liquidación REGANECU/BC en ${monthsCoveredBySettlement} de 12 meses para ${year}; se ha complementado o contrastado con energía facturada elevada a Barras de Central. Verifique el campo 9 antes de presentar.`
      );
    }
    if (fields.energiaSuministradaPrecioNoIndexadoMD > fields.energiaSuministrada) {
      warnings.push(
        'La energía suministrada a precio no indexado (campo 10) supera la energía total suministrada (campo 9). Revise ambos valores.'
      );
    }

    const filename = `Coberturas_${ctx.codigoAgente}_${year}.csv`;
    const totalCubiertaKwh =
      fields.energiaCubiertaIntragrupoNuclear +
      fields.energiaCubiertaIntragrupoHidraulica +
      fields.energiaCubiertaIntragrupoResto +
      fields.energiaCubiertaAPlazoCCC +
      fields.energiaCubiertaAPlazoNoCCC +
      fields.energiaCubiertaOtrosCCC +
      fields.energiaCubiertaOtrosNoCCC;

    const summary = {
      year,
      totalCubiertaKwh,
      energiaSuministradaKwh: fields.energiaSuministrada,
      energiaNoIndexadaKwh: fields.energiaSuministradaPrecioNoIndexadoMD,
      porcentajeFijo: Number((fixedShare * 100).toFixed(2)),
      mesesReganecu: monthsCoveredBySettlement,
    };

    if (isPreview) {
      return NextResponse.json({
        company: {
          name: ctx.company.name,
          cif: ctx.company.cif,
          codigoAgente: ctx.codigoAgente,
        },
        year,
        filename,
        fields,
        autoCalculated: {
          bcReganecuKwh: Math.round(bcMwhFromReganecuOrSummary * 1000),
          bcEstimatedFromInvoicesKwh: Math.round(estimatedBcFromInvoicesMwh * 1000),
          fixedInvoicedMwh: Number(fixedInvoicedMwh.toFixed(2)),
          indexedInvoicedMwh: Number(indexedInvoicedMwh.toFixed(2)),
          fixedSharePct: Number((fixedShare * 100).toFixed(2)),
          ppaBreakdown,
        },
        summary,
        warnings,
      });
    }

    // Formato oficial Circular CIR/DE/007/25 (Formatos_fichero_Coberturas.docx y Coberturas_R2-950_2025.csv):
    // UTF-8 CSV RFC 4180 separado por comas, 1 única fila de 10 campos obligatorios sin cabecera.
    const csvLine = [
      fields.codigoComercializador,
      fields.energiaCubiertaIntragrupoNuclear,
      fields.energiaCubiertaIntragrupoHidraulica,
      fields.energiaCubiertaIntragrupoResto,
      fields.energiaCubiertaAPlazoCCC,
      fields.energiaCubiertaAPlazoNoCCC,
      fields.energiaCubiertaOtrosCCC,
      fields.energiaCubiertaOtrosNoCCC,
      fields.energiaSuministrada,
      fields.energiaSuministradaPrecioNoIndexadoMD,
    ].join(',') + '\n';

    await logRegulatoryGeneration({
      companyId: ctx.companyId,
      category: 'CNMC',
      reportType: 'COBERTURAS',
      period: String(year),
      version: null,
      filename,
      generatedBy: ctx.userName,
      summary,
    });

    return new NextResponse(csvLine, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generando Coberturas CNMC:', error);
    return NextResponse.json(
      { error: 'Error interno generando el fichero de Coberturas CNMC' },
      { status: 500 }
    );
  }
}
