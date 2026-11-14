import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

const EXCLUDED_CONTRACT_STATUS_REGEX = /rechaz|borrador|draft|anulad|cancel|tramit|solicitud/i;

function toUtcDateOnly(d: Date | string): Date {
  const iso = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function prorateEnergyForMonth(
  rawStart: Date,
  rawEnd: Date,
  monthStartUtc: Date,
  monthEndDateOnlyUtc: Date,
  signedMwh: number
): number {
  const sUtc = toUtcDateOnly(rawStart);
  const eUtc = toUtcDateOnly(rawEnd);
  if (eUtc < sUtc) return 0;

  const oStart = sUtc < monthStartUtc ? monthStartUtc : sUtc;
  const oEnd = eUtc > monthEndDateOnlyUtc ? monthEndDateOnlyUtc : eUtc;
  if (oEnd < oStart) return 0;

  const totalDays = Math.round((eUtc.getTime() - sUtc.getTime()) / 86_400_000) + 1;
  const overlapDays = Math.round((oEnd.getTime() - oStart.getTime()) / 86_400_000) + 1;
  return totalDays > 0 ? (signedMwh * overlapDays) / totalDays : 0;
}

function extractF1ActiveEnergyKwh(jsonData: any): number {
  if (!jsonData || typeof jsonData !== 'object') return 0;
  const periodosRaw = jsonData?.EnergiaActiva?.TerminoEnergiaActiva?.Periodo;
  if (!periodosRaw) return 0;
  const periodos = Array.isArray(periodosRaw) ? periodosRaw : [periodosRaw];
  let sumKwh = 0;
  for (const p of periodos) {
    const rawVal = p?.ValorEnergiaActiva;
    if (rawVal === undefined || rawVal === null) continue;
    const parsed = parseFloat(String(rawVal).replace(',', '.'));
    if (!isNaN(parsed)) sumKwh += parsed;
  }
  return sumKwh;
}

type ContractSpan = {
  status: string;
  startMs: number;
  endMs: number | null;
};

function isDayWithinContracts(spans: ContractSpan[], dayMs: number): boolean {
  for (const s of spans) {
    if (dayMs >= s.startMs && (s.endMs === null || dayMs <= s.endMs)) {
      return true;
    }
  }
  return false;
}

function doesSupplyPointHaveActiveOverlap(
  spans: ContractSpan[],
  monthStartMs: number,
  monthEndMs: number
): boolean {
  for (const s of spans) {
    if (s.startMs <= monthEndMs && (s.endMs === null || s.endMs >= monthStartMs)) {
      return true;
    }
  }
  return false;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ month: string }> }
) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role as string | undefined;
    if (!session || !hasAdminOrBackofficeRole(role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { month } = await ctx.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Formato de mes inválido (esperado YYYY-MM)' }, { status: 400 });
    }

    let activeCompanyId = await resolveActiveCompanyId(session);
    if (!activeCompanyId && role === 'SUPERADMIN') {
      const firstComp = await prisma.company.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
      activeCompanyId = firstComp?.id || null;
    }
    if (!activeCompanyId) {
      return NextResponse.json({ error: 'No se pudo determinar la comercializadora activa' }, { status: 400 });
    }

    const [yearNum, monthNum] = month.split('-').map(Number);
    const monthStartUtc = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
    const monthEndDateOnlyUtc = new Date(Date.UTC(yearNum, monthNum, 0, 0, 0, 0, 0));
    const monthEndUtc = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
    const daysInMonth = monthEndDateOnlyUtc.getUTCDate();
    const monthStartMs = monthStartUtc.getTime();
    const monthEndDateOnlyMs = monthEndDateOnlyUtc.getTime();

    const [summary, supplyPoints, invoices, internalInvoices, unbilledF1s, dailyCurvesRaw] = await Promise.all([
      prisma.pendingEnergySummary.findUnique({
        where: {
          month_companyId: {
            month,
            companyId: activeCompanyId,
          },
        },
      }),
      prisma.supplyPoint.findMany({
        where: {
          OR: [
            { client: { brand: { companyId: activeCompanyId } } },
            { contracts: { some: { brand: { companyId: activeCompanyId } } } },
          ],
        },
        select: {
          id: true,
          cups: true,
          tariff: true,
          distributor: true,
          distributorName: true,
          hasSelfConsumption: true,
          client: {
            select: {
              businessName: true,
              firstName: true,
              lastName: true,
            },
          },
          contracts: {
            select: {
              status: true,
              activationDate: true,
              terminationDate: true,
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          billingStart: { lte: monthEndUtc },
          billingEnd: { gte: monthStartUtc },
          OR: [
            { companyId: activeCompanyId },
            { companyId: null, client: { brand: { companyId: activeCompanyId } } },
          ],
        },
        select: {
          invoiceNumber: true,
          invoiceType: true,
          billingStart: true,
          billingEnd: true,
          totalMWh: true,
          totalAmount: true,
          supplyPointId: true,
          f1InvoiceId: true,
        },
      }),
      prisma.internalInvoice.findMany({
        where: {
          status: { in: ['EMITIDA', 'ABONO'] },
          hidden: false,
          billingStart: { lte: monthEndUtc },
          billingEnd: { gte: monthStartUtc },
          OR: [
            { companyId: activeCompanyId },
            { companyId: null, client: { brand: { companyId: activeCompanyId } } },
          ],
        },
        select: {
          invoiceNumber: true,
          invoiceType: true,
          status: true,
          billingStart: true,
          billingEnd: true,
          totalMWh: true,
          totalAmount: true,
          supplyPointId: true,
          f1InvoiceId: true,
        },
      }),
      prisma.f1Invoice.findMany({
        where: {
          tipoDocumento: 'FacturaATR',
          fechaInicio: { lte: monthEndUtc },
          fechaFin: { gte: monthStartUtc },
          invoices: { none: {} },
          internalInvoices: { none: { status: { in: ['EMITIDA', 'ABONO'] }, hidden: false } },
          supplyPoint: { client: { brand: { companyId: activeCompanyId } } },
        },
        select: {
          supplyPointId: true,
          fechaInicio: true,
          fechaFin: true,
          jsonData: true,
        },
      }),
      prisma.$queryRaw<
        Array<{
          baseCups: string;
          date: Date;
          type: string;
          isProvisional: boolean;
          kwh: number;
        }>
      >`
        SELECT
          SUBSTRING(lc.cups FROM 1 FOR 20) AS "baseCups",
          lc.date AS "date",
          lc.type::text AS "type",
          lc."isProvisional" AS "isProvisional",
          (SELECT COALESCE(SUM(v), 0) FROM unnest(lc.readings) AS v)::float8 AS "kwh"
        FROM "LoadCurve" lc
        WHERE lc.date >= ${monthStartUtc}::date
          AND lc.date <= ${monthEndDateOnlyUtc}::date
      `,
    ]);

    type CupsBucket = {
      supplyPointId: string;
      cups: string;
      baseCups: string;
      clientName: string;
      tariff: string;
      distributor: string;
      hasSelfConsumption: boolean;
      isActiveInMonth: boolean;
      spans: ContractSpan[];
      billedMwh: number;
      invoiceCount: number;
      unbilledF1Mwh: number;
      cchMwh: number;
      surplusMwh: number;
      cchDays: number;
      provisionalDays: number;
      definitiveDays: number;
    };

    const bySupplyPointId = new Map<string, CupsBucket>();
    const byBaseCups = new Map<string, CupsBucket>();

    for (const sp of supplyPoints) {
      const baseCups = sp.cups.substring(0, 20);
      const clientFullName =
        sp.client?.businessName?.trim() ||
        [sp.client?.firstName, sp.client?.lastName].filter(Boolean).join(' ').trim() ||
        'Cliente sin nombre';
      const distributorLabel =
        sp.distributor?.trim() || sp.distributorName?.trim() || 'Sin distribuidora asignada';

      const spans: ContractSpan[] = [];
      for (const c of sp.contracts) {
        if (!c.activationDate) continue;
        if (c.status && EXCLUDED_CONTRACT_STATUS_REGEX.test(c.status)) continue;
        spans.push({
          status: c.status,
          startMs: toUtcDateOnly(c.activationDate).getTime(),
          endMs: c.terminationDate ? toUtcDateOnly(c.terminationDate).getTime() : null,
        });
      }

      const existing = byBaseCups.get(baseCups);
      if (existing) {
        existing.spans.push(...spans);
        if (doesSupplyPointHaveActiveOverlap(existing.spans, monthStartMs, monthEndDateOnlyMs)) {
          existing.isActiveInMonth = true;
        }
        bySupplyPointId.set(sp.id, existing);
        continue;
      }

      const bucket: CupsBucket = {
        supplyPointId: sp.id,
        cups: sp.cups,
        baseCups,
        clientName: clientFullName,
        tariff: (sp.tariff || '2.0TD').trim().toUpperCase(),
        distributor: distributorLabel,
        hasSelfConsumption: Boolean(sp.hasSelfConsumption),
        isActiveInMonth: doesSupplyPointHaveActiveOverlap(spans, monthStartMs, monthEndDateOnlyMs),
        spans,
        billedMwh: 0,
        invoiceCount: 0,
        unbilledF1Mwh: 0,
        cchMwh: 0,
        surplusMwh: 0,
        cchDays: 0,
        provisionalDays: 0,
        definitiveDays: 0,
      };

      byBaseCups.set(baseCups, bucket);
      bySupplyPointId.set(sp.id, bucket);
    }

    // 1. Acumular facturación prorrateada por CUPS
    const billedF1Ids = new Set<string>();
    const billedInvoiceNumbers = new Set<string>();
    let unassignedBilledMwh = 0;

    for (const inv of invoices) {
      if (inv.f1InvoiceId) billedF1Ids.add(inv.f1InvoiceId);
      if (inv.invoiceNumber) billedInvoiceNumbers.add(inv.invoiceNumber);
      if (!inv.billingStart || !inv.billingEnd) continue;

      let rawMwh = (inv.totalMWh || 0) / 1000;
      const typeLower = (inv.invoiceType || '').toLowerCase();
      if (typeLower.includes('abono') || ((inv.totalAmount ?? 0) < 0 && rawMwh > 0)) {
        rawMwh = -Math.abs(rawMwh);
      }

      const prorated = prorateEnergyForMonth(
        inv.billingStart,
        inv.billingEnd,
        monthStartUtc,
        monthEndDateOnlyUtc,
        rawMwh
      );
      if (prorated === 0) continue;

      const bucket = inv.supplyPointId ? bySupplyPointId.get(inv.supplyPointId) : undefined;
      if (bucket) {
        bucket.billedMwh += prorated;
        bucket.invoiceCount += 1;
      } else {
        unassignedBilledMwh += prorated;
      }
    }

    for (const iInv of internalInvoices) {
      if (iInv.f1InvoiceId && billedF1Ids.has(iInv.f1InvoiceId)) continue;
      if (iInv.invoiceNumber && billedInvoiceNumbers.has(iInv.invoiceNumber)) continue;
      if (!iInv.billingStart || !iInv.billingEnd) continue;

      let rawMwh = iInv.totalMWh || 0;
      const typeLower = (iInv.invoiceType || '').toLowerCase();
      if (iInv.status === 'ABONO' || typeLower.includes('abono') || ((iInv.totalAmount ?? 0) < 0 && rawMwh > 0)) {
        rawMwh = -Math.abs(rawMwh);
      }

      const prorated = prorateEnergyForMonth(
        iInv.billingStart,
        iInv.billingEnd,
        monthStartUtc,
        monthEndDateOnlyUtc,
        rawMwh
      );
      if (prorated === 0) continue;

      const bucket = iInv.supplyPointId ? bySupplyPointId.get(iInv.supplyPointId) : undefined;
      if (bucket) {
        bucket.billedMwh += prorated;
        bucket.invoiceCount += 1;
      } else {
        unassignedBilledMwh += prorated;
      }
    }

    for (const f1 of unbilledF1s) {
      if (!f1.fechaInicio || !f1.fechaFin) continue;
      const kwh = extractF1ActiveEnergyKwh(f1.jsonData);
      if (kwh === 0) continue;
      const prorated = prorateEnergyForMonth(
        f1.fechaInicio,
        f1.fechaFin,
        monthStartUtc,
        monthEndDateOnlyUtc,
        kwh / 1000
      );
      const bucket = f1.supplyPointId ? bySupplyPointId.get(f1.supplyPointId) : undefined;
      if (bucket) {
        bucket.unbilledF1Mwh += prorated;
      }
    }

    // 2. Acumular curvas CCH diarias filtrando días con contrato activo (misma regla que AggregationService)
    let totalDefinitiveCurveDays = 0;
    let totalProvisionalCurveDays = 0;

    for (const lc of dailyCurvesRaw) {
      const bucket = byBaseCups.get(lc.baseCups);
      if (!bucket) continue;

      const dayMs = toUtcDateOnly(lc.date).getTime();
      if (!isDayWithinContracts(bucket.spans, dayMs)) continue;

      const mwh = (Number(lc.kwh) || 0) / 1000;
      if (lc.type === 'SURPLUS') {
        bucket.surplusMwh += mwh;
      } else {
        bucket.cchMwh += mwh;
        bucket.cchDays += 1;
        if (lc.isProvisional) {
          bucket.provisionalDays += 1;
          totalProvisionalCurveDays += 1;
        } else {
          bucket.definitiveDays += 1;
          totalDefinitiveCurveDays += 1;
        }
      }
    }

    // 3. Construir resumen por distribuidora y ranking de CUPS con mayor descuadre
    const distMap = new Map<
      string,
      {
        distributor: string;
        activeCups: number;
        cupsWithCch: number;
        cupsMissingCch: number;
        billedMwh: number;
        unbilledF1Mwh: number;
        cchMwh: number;
        surplusMwh: number;
        gapMwh: number;
      }
    >();

    const allRelevantCups: Array<{
      supplyPointId: string;
      cups: string;
      clientName: string;
      tariff: string;
      distributor: string;
      cchDays: number;
      provisionalDays: number;
      billedMwh: number;
      unbilledF1Mwh: number;
      cchMwh: number;
      surplusMwh: number;
      gapMwh: number;
      statusTag: 'SIN_CCH' | 'CCH_INCOMPLETA' | 'FACTURADO_MAYOR' | 'CCH_MAYOR' | 'SIN_FACTURAR' | 'OK';
    }> = [];

    let activeCupsCount = 0;
    let activeCupsWithCch = 0;
    let activeCupsMissingCch = 0;

    for (const b of byBaseCups.values()) {
      const hasActivity =
        b.isActiveInMonth ||
        Math.abs(b.billedMwh) > 0.0001 ||
        Math.abs(b.unbilledF1Mwh) > 0.0001 ||
        b.cchDays > 0;
      if (!hasActivity) continue;

      if (b.isActiveInMonth) {
        activeCupsCount++;
        if (b.cchDays > 0) activeCupsWithCch++;
        else activeCupsMissingCch++;
      }

      const gapMwh = b.billedMwh - b.cchMwh;

      let dRow = distMap.get(b.distributor);
      if (!dRow) {
        dRow = {
          distributor: b.distributor,
          activeCups: 0,
          cupsWithCch: 0,
          cupsMissingCch: 0,
          billedMwh: 0,
          unbilledF1Mwh: 0,
          cchMwh: 0,
          surplusMwh: 0,
          gapMwh: 0,
        };
        distMap.set(b.distributor, dRow);
      }
      if (b.isActiveInMonth) {
        dRow.activeCups += 1;
        if (b.cchDays > 0) dRow.cupsWithCch += 1;
        else dRow.cupsMissingCch += 1;
      }
      dRow.billedMwh += b.billedMwh;
      dRow.unbilledF1Mwh += b.unbilledF1Mwh;
      dRow.cchMwh += b.cchMwh;
      dRow.surplusMwh += b.surplusMwh;
      dRow.gapMwh += gapMwh;

      let statusTag: 'SIN_CCH' | 'CCH_INCOMPLETA' | 'FACTURADO_MAYOR' | 'CCH_MAYOR' | 'SIN_FACTURAR' | 'OK' = 'OK';
      if (b.cchDays === 0 && b.billedMwh > 0.01) {
        statusTag = 'SIN_CCH';
      } else if (b.billedMwh === 0 && b.cchMwh > 0.01) {
        statusTag = 'SIN_FACTURAR';
      } else if (b.cchDays > 0 && b.cchDays < daysInMonth - 2 && Math.abs(gapMwh) > 0.02) {
        statusTag = 'CCH_INCOMPLETA';
      } else if (gapMwh > 0.05) {
        statusTag = 'FACTURADO_MAYOR';
      } else if (gapMwh < -0.05) {
        statusTag = 'CCH_MAYOR';
      }

      allRelevantCups.push({
        supplyPointId: b.supplyPointId,
        cups: b.cups,
        clientName: b.clientName,
        tariff: b.tariff,
        distributor: b.distributor,
        cchDays: b.cchDays,
        provisionalDays: b.provisionalDays,
        billedMwh: Number(b.billedMwh.toFixed(3)),
        unbilledF1Mwh: Number(b.unbilledF1Mwh.toFixed(3)),
        cchMwh: Number(b.cchMwh.toFixed(3)),
        surplusMwh: Number(b.surplusMwh.toFixed(3)),
        gapMwh: Number(gapMwh.toFixed(3)),
        statusTag,
      });
    }

    const byDistributor = Array.from(distMap.values())
      .map((d) => ({
        ...d,
        billedMwh: Number(d.billedMwh.toFixed(2)),
        unbilledF1Mwh: Number(d.unbilledF1Mwh.toFixed(2)),
        cchMwh: Number(d.cchMwh.toFixed(2)),
        surplusMwh: Number(d.surplusMwh.toFixed(2)),
        gapMwh: Number(d.gapMwh.toFixed(2)),
      }))
      .sort((a, b) => Math.abs(b.gapMwh) - Math.abs(a.gapMwh));

    const topCupsDiscrepancies = allRelevantCups
      .sort((a, b) => Math.abs(b.gapMwh) - Math.abs(a.gapMwh))
      .slice(0, 50);

    return NextResponse.json(
      {
        success: true,
        month,
        daysInMonth,
        summary,
        quality: {
          activeCupsCount,
          activeCupsWithCch,
          activeCupsMissingCch,
          totalDefinitiveCurveDays,
          totalProvisionalCurveDays,
          unassignedBilledMwh: Number(unassignedBilledMwh.toFixed(3)),
        },
        byDistributor,
        topCupsDiscrepancies,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error generando auditoría mensual de energía pendiente:', error);
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
  }
}
