'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { addMonths, subMonths, getDaysInMonth } from 'date-fns';

export interface MonthlyProjection {
  monthName: string;
  monthNum: number;
  year: number;
  mwh: number;
  percentage: number;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function get12MonthProjectionAction(): Promise<{ success: true; data: MonthlyProjection[] } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    const cookieStore = await cookies();
    const activeCompanyId = cookieStore.get('active-company')?.value || (session.user as any).companyId;

    if (!activeCompanyId) throw new Error('No active company selected');

    // Fetch active contracts
    const contractsRaw = await prisma.$queryRaw`
      SELECT 
        sp."cups",
        sp."annualConsumption"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      JOIN "Brand" b ON c."brandId" = b.id
      WHERE c.status IN ('ACTIVO', 'Activo')
      AND b."companyId" = ${activeCompanyId}
    `;

    const today = new Date();

    // Fetch history for seasonality
    const historyM12 = await prisma.$queryRaw`
      SELECT 
        sp."cups",
        EXTRACT(MONTH FROM i."billingEnd") as "month",
        SUM(
          CASE 
            WHEN i."invoiceType" ILIKE '%abono%' THEN -1 * ABS(i."totalMWh")
            ELSE ABS(i."totalMWh") 
          END
        ) / 1000 as "totalMWh",
        SUM(
          CASE 
            WHEN i."invoiceType" ILIKE '%abono%' THEN -1 * EXTRACT(DAY FROM (i."billingEnd" - i."billingStart"))
            ELSE EXTRACT(DAY FROM (i."billingEnd" - i."billingStart")) 
          END
        ) as "days"
      FROM "Invoice" i
      JOIN "SupplyPoint" sp ON i."supplyPointId" = sp.id
      WHERE i."billingEnd" >= ${subMonths(today, 15)}
        AND i."billingStart" IS NOT NULL
        AND i."billingEnd" IS NOT NULL
      GROUP BY sp."cups", EXTRACT(MONTH FROM i."billingEnd")
    `;

    const m12Map = new Map<string, number>();
    for (const row of (historyM12 as any[])) {
      if (row.days && Number(row.days) > 0) {
        m12Map.set(`${row.cups}_${row.month}`, Number(row.totalMWh) / Number(row.days));
      }
    }

    // Prepare 12 months array
    const projection: MonthlyProjection[] = [];
    for (let i = 1; i <= 12; i++) {
      const targetMonth = addMonths(today, i);
      projection.push({
        monthName: `${MONTH_NAMES[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`,
        monthNum: targetMonth.getMonth() + 1,
        year: targetMonth.getFullYear(),
        mwh: 0,
        percentage: 0
      });
    }

    // Coeficientes estándar de estacionalidad en España (Base 1.0 = media). 
    // Suman 12 en total. Aumentan el peso en invierno (calefacción) y verano (A/C).
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
      12: 1.05  // Diciembre
    };

    let totalMwh = 0;

    for (const row of (contractsRaw as any[])) {
      const annualConsumption = Number(row.annualConsumption) || 0;
      if (annualConsumption <= 0) continue;

      const dailyConsumption = annualConsumption / 365;

      for (let i = 0; i < 12; i++) {
        const p = projection[i];
        const daysInTargetMonth = getDaysInMonth(new Date(p.year, p.monthNum - 1));
        const seasonalMultiplier = SEASONAL_COEFFICIENTS[p.monthNum] || 1.0;
        
        let mwhThisMonth = 0;
        if (annualConsumption >= 40) {
          const seasonalDaily = m12Map.get(`${row.cups}_${p.monthNum}`);
          mwhThisMonth = (seasonalDaily !== undefined ? seasonalDaily : (dailyConsumption * seasonalMultiplier)) * daysInTargetMonth;
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
