'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveDashboardAccess } from '@/lib/dashboardAccess';

export interface EconomicAnalysisRow {
  month: string;
  facturacionEur: number;
  facturacionMwh: number; // kWh brutos (compatibilidad histórica)
  energiaFacturadaMwh: number; // MWh reales (kWh / 1000)
  eurPerMwh: number; // €/kWh (compatibilidad histórica; * 1000 = €/MWh)
  precioMedioEurMwh: number; // €/MWh directo
  margenEur: number;
  margenEurMwh: number; // €/MWh de margen comercial
  margenPercent: number;
  altas: number;
  bajas: number;
  contratosActivos: number;
  mwhAltas: number;
  mwhBajas: number;
  mwhActivos: number;
  crecimientoMes: number;
  proyeccionAlta: number;
  proyeccionCompleto: number;
}

const madridMonthFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
});

function toMadridYearMonth(d: Date): string {
  return madridMonthFormatter.format(d);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function getEconomicAnalysis(): Promise<EconomicAnalysisRow[]> {
  try {
    const access = await resolveDashboardAccess();
    if (!access.isAuthorized) {
      return [];
    }

    if (access.scopedBrandIds !== null && access.scopedBrandIds.length === 0) {
      return [];
    }

    const brandSqlCondition =
      access.scopedBrandIds === null
        ? Prisma.empty
        : Prisma.sql`AND cl."brandId" IN (${Prisma.join(access.scopedBrandIds)})`;

    // Ejecutamos en paralelo:
    // 1) Agregación directa en PostgreSQL de facturas oficiales (excluyendo Penalización,
    //    respetando huso Europe/Madrid y manteniendo intacto el signo ya corregido de Invoice.margin).
    // 2) Carga ligera de contratos para cálculo de altas/bajas netas por CUPS20 con 30 días de gracia.
    const [invoiceRows, contracts] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          month: string;
          total_eur: Prisma.Decimal | number | string | null;
          total_kwh: Prisma.Decimal | number | string | null;
          margin: Prisma.Decimal | number | string | null;
        }>
      >(Prisma.sql`
        SELECT
          to_char((COALESCE(i."billingEnd", i."issueDate") AT TIME ZONE 'Europe/Madrid'), 'YYYY-MM') AS month,
          SUM(
            CASE
              WHEN v.is_abono THEN -ABS(v.base_eur)
              ELSE v.base_eur
            END
          ) AS total_eur,
          SUM(
            CASE
              WHEN v.is_abono THEN -ABS(COALESCE(i."totalMWh", 0))
              ELSE COALESCE(i."totalMWh", 0)
            END
          ) AS total_kwh,
          SUM(COALESCE(i."margin", 0)) AS margin
        FROM "Invoice" i
        INNER JOIN "Client" cl ON cl.id = i."clientId"
        CROSS JOIN LATERAL (
          SELECT
            (
              UPPER(COALESCE(i."invoiceType", '')) LIKE '%ABONO%'
              OR UPPER(COALESCE(i."invoiceType", '')) IN ('A', 'AR', 'S')
            ) AS is_abono,
            COALESCE(
              CASE
                WHEN v_raw.bi1 ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(v_raw.bi1 AS NUMERIC)
                ELSE NULL
              END,
              CASE
                WHEN v_raw.bi2 ~ '^-?[0-9]+(\.[0-9]+)?$' THEN CAST(v_raw.bi2 AS NUMERIC)
                ELSE NULL
              END,
              CAST(i."subtotal1" AS NUMERIC),
              0
            ) AS base_eur
          FROM (
            SELECT
              REPLACE(TRIM(COALESCE(i."invoiceData"->>'Base Imponible IVA', '')), ',', '.') AS bi1,
              REPLACE(TRIM(COALESCE(i."invoiceData"->>'Base Imponible IVA CORR', '')), ',', '.') AS bi2
          ) v_raw
        ) v
        WHERE COALESCE(i."billingEnd", i."issueDate") IS NOT NULL
          AND UPPER(COALESCE(i."invoiceType", '')) NOT LIKE '%PENALIZ%'
          ${brandSqlCondition}
        GROUP BY 1
      `),
      prisma.contract.findMany({
        where: {
          ...access.contractWhere,
          status: { in: ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'] },
        },
        select: {
          activationDate: true,
          terminationDate: true,
          annualConsumption: true,
          supplyPointId: true,
          supplyPoint: {
            select: { cups: true, annualConsumption: true },
          },
        },
      }),
    ]);

    const invoicesData: Record<string, { total_eur: number; total_kwh: number; margin: number }> = {};
    for (const row of invoiceRows) {
      if (!row.month) continue;
      invoicesData[row.month] = {
        total_eur: Number(row.total_eur) || 0,
        total_kwh: Number(row.total_kwh) || 0,
        margin: Number(row.margin) || 0,
      };
    }

    // Agrupación de Altas y Bajas netas por CUPS20 con 30 días de carencia (Reglas 17, 47 y 124)
    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
    const altasData: Record<string, { count: number; mwh: number }> = {};
    const bajasData: Record<string, { count: number; mwh: number }> = {};

    const contractsByCups: Record<string, typeof contracts> = {};
    for (const c of contracts) {
      const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
      if (!cupsKey || !c.activationDate) continue;
      if (!contractsByCups[cupsKey]) contractsByCups[cupsKey] = [];
      contractsByCups[cupsKey].push(c);
    }

    for (const cupsContracts of Object.values(contractsByCups)) {
      cupsContracts.sort((a, b) => a.activationDate!.getTime() - b.activationDate!.getTime());

      let currentPeriod: { start: Date; end: Date | null; mwh: number } | null = null;
      const periods: Array<{ start: Date; end: Date | null; mwh: number }> = [];

      for (const c of cupsContracts) {
        const startDate = c.activationDate!;
        // Saneamiento de fechas invertidas (terminationDate < activationDate)
        const effectiveEnd =
          c.terminationDate && c.terminationDate.getTime() < startDate.getTime()
            ? startDate
            : c.terminationDate || null;
        const mwh = Number(c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? 0) || 0;

        if (!currentPeriod) {
          currentPeriod = { start: startDate, end: effectiveEnd, mwh };
          continue;
        }

        if (currentPeriod.end === null) {
          if (mwh > 0) currentPeriod.mwh = mwh;
        } else if (startDate.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
          if (!effectiveEnd) {
            currentPeriod.end = null;
          } else if (effectiveEnd.getTime() > currentPeriod.end.getTime()) {
            currentPeriod.end = effectiveEnd;
          }
          if (mwh > 0) currentPeriod.mwh = mwh;
        } else {
          periods.push({
            start: currentPeriod.start,
            end: currentPeriod.end,
            mwh: currentPeriod.mwh,
          });
          currentPeriod = { start: startDate, end: effectiveEnd, mwh };
        }
      }

      if (currentPeriod) {
        periods.push({
          start: currentPeriod.start,
          end: currentPeriod.end,
          mwh: currentPeriod.mwh,
        });
      }

      for (const p of periods) {
        const altaM = toMadridYearMonth(p.start);
        if (!altasData[altaM]) altasData[altaM] = { count: 0, mwh: 0 };
        altasData[altaM].count += 1;
        altasData[altaM].mwh = round2(altasData[altaM].mwh + p.mwh);

        if (p.end) {
          const bajaM = toMadridYearMonth(p.end);
          if (!bajasData[bajaM]) bajasData[bajaM] = { count: 0, mwh: 0 };
          bajasData[bajaM].count += 1;
          bajasData[bajaM].mwh = round2(bajasData[bajaM].mwh + p.mwh);
        }
      }
    }

    const allMonths = new Set<string>([
      ...Object.keys(invoicesData),
      ...Object.keys(altasData),
      ...Object.keys(bajasData),
    ]);
    const sortedMonths = Array.from(allMonths).sort();

    let activeContractsCount = 0;
    let activeMWh = 0;

    return sortedMonths.map((month) => {
      const inv = invoicesData[month] || { total_eur: 0, total_kwh: 0, margin: 0 };
      const alt = altasData[month] || { count: 0, mwh: 0 };
      const baj = bajasData[month] || { count: 0, mwh: 0 };

      const factEur = round2(inv.total_eur);
      const factKwh = round2(inv.total_kwh);
      const energiaMwh = round2(factKwh / 1000);
      const margin = round2(inv.margin);

      const altasCount = alt.count;
      const altasMwh = round2(alt.mwh);
      const bajasCount = baj.count;
      const bajasMwh = round2(baj.mwh);

      const prevActiveCount = activeContractsCount;
      const prevActiveMWh = activeMWh;

      activeContractsCount = Math.max(0, prevActiveCount + altasCount - bajasCount);
      activeMWh = Math.max(0, round2(prevActiveMWh + altasMwh - bajasMwh));

      const netDeltaMwh = round2(altasMwh - bajasMwh);
      const crecimientoNeto =
        prevActiveMWh > 0
          ? netDeltaMwh / prevActiveMWh
          : altasMwh > 0
            ? 1
            : 0;

      const monthNum = parseInt(month.split('-')[1] || '1', 10);

      return {
        month,
        facturacionEur: factEur,
        facturacionMwh: factKwh,
        energiaFacturadaMwh: energiaMwh,
        eurPerMwh: factKwh > 0 ? factEur / factKwh : 0,
        precioMedioEurMwh: energiaMwh > 0 ? round2(factEur / energiaMwh) : 0,
        margenEur: margin,
        margenEurMwh: energiaMwh > 0 ? round2(margin / energiaMwh) : 0,
        margenPercent: factEur > 0 ? margin / factEur : 0,
        altas: altasCount,
        bajas: bajasCount,
        contratosActivos: activeContractsCount,
        mwhAltas: altasMwh,
        mwhBajas: bajasMwh,
        mwhActivos: activeMWh,
        crecimientoMes: crecimientoNeto,
        proyeccionAlta: round2(altasMwh * 200 * ((12 - monthNum) / 12)),
        proyeccionCompleto: round2(altasMwh * 200),
      };
    });
  } catch (error) {
    console.error('Error generating economic analysis:', error);
    return [];
  }
}
