'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { endOfMonth, startOfMonth, subMonths, isBefore, isAfter, min, max, differenceInDays } from 'date-fns';

export interface PendingEnergyData {
  contractId: string;
  contractCode: string;
  cups: string;
  status: string;
  lastBilledDate: string | null;
  annualConsumption: number;
  totalPendingDays: number;
  totalPendingMWh: number;
  m0PendingMWh: number;
  m1PendingMWh: number;
  m2PendingMWh: number;
}

export async function getPendingEnergyAction(): Promise<{ success: true; data: PendingEnergyData[] } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    const cookieStore = await cookies();
    const activeCompanyId = cookieStore.get('active-company')?.value || (session.user as any).companyId;

    if (!activeCompanyId) throw new Error('No active company selected');

    // Fetch contracts with their latest invoice date
    const contractsRaw = await prisma.$queryRaw`
      SELECT 
        c.id as "contractId",
        c."contractCode",
        c."status",
        c."activationDate",
        c."terminationDate",
        c."airtableData",
        sp."annualConsumption",
        sp."cups",
        i_max."lastBilledDate"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      JOIN "Brand" b ON c."brandId" = b.id
      LEFT JOIN (
        SELECT sp2."cups", MAX(i2."billingEnd") as "lastBilledDate"
        FROM "Invoice" i2
        JOIN "Contract" c2 ON i2."contractId" = c2.id
        JOIN "SupplyPoint" sp2 ON c2."supplyPointId" = sp2.id
        GROUP BY sp2."cups"
      ) i_max ON i_max."cups" = sp."cups"
      WHERE c.status IN ('ACTIVO', 'FINALIZADO', 'Finalizado', 'Activo')
      AND c."activationDate" IS NOT NULL
      AND b."companyId" = ${activeCompanyId}
    `;

    const today = new Date();

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

    // M0
    const m0Start = startOfMonth(today);
    const m0End = endOfMonth(today);
    // M-1
    const m1Start = startOfMonth(subMonths(today, 1));
    const m1End = endOfMonth(subMonths(today, 1));
    // M-2
    const m2Start = startOfMonth(subMonths(today, 2));
    const m2End = endOfMonth(subMonths(today, 2));

    const cupsMaxBilledDate = new Map<string, Date>();

    // First pass: determine the true max billed date per CUPS (including Airtable fallbacks)
    for (const row of (contractsRaw as any[])) {
      const { cups, airtableData } = row;
      let { lastBilledDate } = row;

      if (airtableData) {
        const airData = typeof airtableData === 'string' ? JSON.parse(airtableData) : airtableData;
        let airDateStr = airData["ULT DIA FACT"] || airData["ULTIMO DIA FACTURADO"];
        if (airDateStr) {
          const airDate = new Date(airDateStr);
          if (!isNaN(airDate.getTime())) {
            if (!lastBilledDate || airDate > new Date(lastBilledDate)) {
              lastBilledDate = airDate;
            }
          }
        }
      }

      if (lastBilledDate) {
        const dateObj = new Date(lastBilledDate);
        const existing = cupsMaxBilledDate.get(cups);
        if (!existing || dateObj > existing) {
          cupsMaxBilledDate.set(cups, dateObj);
        }
      }
    }

    const results: PendingEnergyData[] = [];

    // Second pass: calculate pending energy using the global CUPS max billed date
    for (const row of (contractsRaw as any[])) {
      const { contractId, contractCode, status, activationDate, terminationDate, annualConsumption, cups } = row;
      
      const lastBilledDate = cupsMaxBilledDate.get(cups) || null;

      const startCalculo = lastBilledDate ? new Date(lastBilledDate) : new Date(activationDate);
      if (lastBilledDate) {
        startCalculo.setDate(startCalculo.getDate() + 1);
      }

      const endCalculo = terminationDate ? new Date(terminationDate) : m0End;

      if (startCalculo > endCalculo) {
        continue;
      }

      const dailyConsumption = (annualConsumption || 0) / 365; // value is already in MWh or small scale

      const getSeasonalDailyConsumption = (targetMonth: Date) => {
        // Aplicar estacionalidad M-12 solo si el consumo anual es grande (> 40 MWh)
        if (!annualConsumption || annualConsumption < 40) return dailyConsumption;
        
        const monthNum = targetMonth.getMonth() + 1;
        const seasonalDaily = m12Map.get(`${cups}_${monthNum}`);
        return seasonalDaily !== undefined ? seasonalDaily : dailyConsumption;
      };

      const getMWhInPeriod = (pStart: Date, pEnd: Date, targetMonth: Date) => {
        const overlapStart = startCalculo > pStart ? startCalculo : pStart;
        const overlapEnd = endCalculo < pEnd ? endCalculo : pEnd;
        if (overlapEnd < overlapStart) return { days: 0, mwh: 0 };
        const days = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // inclusive
        return { days, mwh: days * getSeasonalDailyConsumption(targetMonth) };
      };

      const m0Data = getMWhInPeriod(m0Start, m0End, m0Start);
      const m1Data = getMWhInPeriod(m1Start, m1End, m1Start);
      const m2Data = getMWhInPeriod(m2Start, m2End, m2Start);
      
      const totalPendingDays = m0Data.days + m1Data.days + m2Data.days; // This is a rough estimation of total days if they span exactly these 3 months
      // Calculate true total days for the entire period
      const trueTotalDays = Math.floor((endCalculo.getTime() - startCalculo.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (trueTotalDays <= 0) continue;

      // The total pending MWh is the sum of the months we track + the rest as linear
      const trackedMwh = m0Data.mwh + m1Data.mwh + m2Data.mwh;
      const trackedDays = m0Data.days + m1Data.days + m2Data.days;
      const untrackedDays = trueTotalDays - trackedDays;
      const totalPendingMWh = trackedMwh + (untrackedDays > 0 ? untrackedDays * dailyConsumption : 0);

      results.push({
        contractId,
        contractCode: contractCode || 'Sin Código',
        cups: cups || '',
        status,
        lastBilledDate: lastBilledDate ? new Date(lastBilledDate).toISOString() : null,
        annualConsumption: Number(annualConsumption) || 0,
        totalPendingDays: trueTotalDays,
        totalPendingMWh,
        m0PendingMWh: m0Data.mwh,
        m1PendingMWh: m1Data.mwh,
        m2PendingMWh: m2Data.mwh,
      });
    }

    // Sort by oldest lastBilledDate first, then totalPendingMWh DESC
    results.sort((a, b) => {
      const dateA = a.lastBilledDate ? new Date(a.lastBilledDate).getTime() : 0;
      const dateB = b.lastBilledDate ? new Date(b.lastBilledDate).getTime() : 0;
      
      if (dateA !== dateB) {
        return dateA - dateB; // Oldest first
      }
      return b.totalPendingMWh - a.totalPendingMWh; // Largest MWh first
    });

    return { success: true, data: results };

  } catch (error: any) {
    console.error('Error fetching pending energy:', error);
    return { success: false, error: error.message };
  }
}
