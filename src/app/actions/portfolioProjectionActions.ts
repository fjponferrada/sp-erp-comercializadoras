'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { subMonths, getDaysInMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export interface MonthlyProjection {
  monthName: string;
  monthNum: number;
  year: number;
  mwh: number;
  percentage: number;
}

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export async function get12MonthProjectionAction(
  explicitCompanyId?: string | null
): Promise<{ success: true; data: MonthlyProjection[] } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      throw new Error('Forbidden');
    }

    const activeCompanyId =
      explicitCompanyId || (await resolveActiveCompanyId(session));
    if (!activeCompanyId) throw new Error('No active company selected');

    // 1. Preparar horizonte de 12 meses anclado al calendario Europe/Madrid
    const ymStr = formatInTimeZone(new Date(), 'Europe/Madrid', 'yyyy-MM');
    const [curYear, curMonth1to12] = ymStr.split('-').map(Number);

    const projection: MonthlyProjection[] = [];
    for (let i = 1; i <= 12; i++) {
      const zeroBasedTotal = curYear * 12 + (curMonth1to12 - 1) + i;
      const year = Math.floor(zeroBasedTotal / 12);
      const monthIdx = zeroBasedTotal % 12;
      projection.push({
        monthName: `${MONTH_NAMES[monthIdx]} ${year}`,
        monthNum: monthIdx + 1,
        year,
        mwh: 0,
        percentage: 0,
      });
    }

    // 2. Contratos activos de la comercializadora (soportando herencia de marca por Client y consumo del Contrato o SupplyPoint)
    const contractsRaw = (await prisma.$queryRaw`
      SELECT 
        SUBSTRING(sp."cups", 1, 20) AS "baseCups",
        COALESCE(sp."tariff", p."tariff", '2.0TD') AS "tariff",
        COALESCE(c."annualConsumption", sp."annualConsumption", 0) AS "annualConsumption"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      LEFT JOIN "Product" p ON c."productId" = p.id
      LEFT JOIN "Client" cl ON c."clientId" = cl.id
      JOIN "Brand" b ON COALESCE(c."brandId", cl."brandId") = b.id
      WHERE c.status IN ('ACTIVO', 'Activo', 'ACTIVE', 'Active', 'EN_VIGOR')
        AND b."companyId" = ${activeCompanyId}
      ORDER BY c."activationDate" DESC NULLS LAST
    `) as Array<{ baseCups: string; tariff: string; annualConsumption: number }>;

    if (contractsRaw.length === 0) {
      return { success: true, data: projection };
    }

    // 3. Histórico de facturación M12 para suministros grandes (>= 40 MWh/año), descontando abonos (Reglas 81 y 243)
    const cutoffDate = subMonths(new Date(), 15);
    const historyM12 = (await prisma.$queryRaw`
      SELECT 
        SUBSTRING(sp."cups", 1, 20) AS "baseCups",
        EXTRACT(MONTH FROM i."billingEnd")::int AS "month",
        SUM(
          CASE 
            WHEN i."invoiceType" ILIKE '%abono%' OR i."invoiceType" IN ('A', 'AR', 'S')
              THEN -1 * ABS(COALESCE(i."totalMWh", 0))
            ELSE ABS(COALESCE(i."totalMWh", 0))
          END
        ) / 1000.0 AS "totalMWh",
        SUM(
          CASE 
            WHEN i."invoiceType" ILIKE '%abono%' OR i."invoiceType" IN ('A', 'AR', 'S')
              THEN -1 * GREATEST(1, (CAST(i."billingEnd" AS DATE) - CAST(i."billingStart" AS DATE)))
            ELSE GREATEST(1, (CAST(i."billingEnd" AS DATE) - CAST(i."billingStart" AS DATE)))
          END
        ) AS "days"
      FROM "Invoice" i
      JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
      LEFT JOIN "Client" cl ON sp."clientId" = cl.id
      LEFT JOIN "Brand" b ON cl."brandId" = b.id
      WHERE i."billingEnd" >= ${cutoffDate}
        AND i."billingStart" IS NOT NULL
        AND i."billingEnd" IS NOT NULL
        AND (b."companyId" = ${activeCompanyId} OR b."companyId" IS NULL)
      GROUP BY SUBSTRING(sp."cups", 1, 20), EXTRACT(MONTH FROM i."billingEnd")
    `) as Array<{ baseCups: string; month: number; totalMWh: number; days: number }>;

    const m12Map = new Map<string, number>();
    for (const row of historyM12) {
      if (row.days && Number(row.days) > 0 && Number(row.totalMWh) >= 0) {
        m12Map.set(`${row.baseCups}_${row.month}`, Number(row.totalMWh) / Number(row.days));
      }
    }

    // Coeficientes estándar de estacionalidad en España (Base 1.0 = media; suman 12.0)
    const SEASONAL_COEFFICIENTS: Record<number, number> = {
      1: 1.15, // Enero
      2: 1.08, // Febrero
      3: 1.02, // Marzo
      4: 0.92, // Abril
      5: 0.85, // Mayo
      6: 0.95, // Junio
      7: 1.08, // Julio
      8: 1.12, // Agosto
      9: 0.95, // Septiembre
      10: 0.88, // Octubre
      11: 0.95, // Noviembre
      12: 1.05, // Diciembre
    };

    let totalMwh = 0;
    const seenCupsProj = new Set<string>();

    for (const row of contractsRaw) {
      if (!row.baseCups || seenCupsProj.has(row.baseCups)) continue;
      seenCupsProj.add(row.baseCups);

      let annualConsumption = Number(row.annualConsumption) || 0;
      if (annualConsumption <= 0) continue;

      // Defensa ante consumos residuales guardados en kWh en suministros 2.0TD (Regla 188)
      if ((row.tariff || '').includes('2.0') && annualConsumption > 500) {
        annualConsumption = annualConsumption / 1000;
      }

      const dailyConsumption = annualConsumption / 365;

      for (let i = 0; i < 12; i++) {
        const p = projection[i];
        const daysInTargetMonth = getDaysInMonth(new Date(p.year, p.monthNum - 1));
        const seasonalMultiplier = SEASONAL_COEFFICIENTS[p.monthNum] || 1.0;

        let mwhThisMonth = 0;
        if (annualConsumption >= 40) {
          const seasonalDaily = m12Map.get(`${row.baseCups}_${p.monthNum}`);
          mwhThisMonth =
            (seasonalDaily !== undefined
              ? seasonalDaily
              : dailyConsumption * seasonalMultiplier) * daysInTargetMonth;
        } else {
          mwhThisMonth = dailyConsumption * seasonalMultiplier * daysInTargetMonth;
        }

        p.mwh += mwhThisMonth;
        totalMwh += mwhThisMonth;
      }
    }

    if (totalMwh > 0) {
      for (const p of projection) {
        p.percentage = (p.mwh / totalMwh) * 100;
      }
    }

    return { success: true, data: projection };
  } catch (error: any) {
    console.error('Error in get12MonthProjectionAction:', error);
    return { success: false, error: error.message };
  }
}
