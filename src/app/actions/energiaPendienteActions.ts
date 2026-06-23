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

      const getDaysInPeriod = (pStart: Date, pEnd: Date) => {
        const overlapStart = startCalculo > pStart ? startCalculo : pStart;
        const overlapEnd = endCalculo < pEnd ? endCalculo : pEnd;
        if (overlapEnd < overlapStart) return 0;
        return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // inclusive
      };

      const daysM0 = getDaysInPeriod(m0Start, m0End);
      const daysM1 = getDaysInPeriod(m1Start, m1End);
      const daysM2 = getDaysInPeriod(m2Start, m2End);
      
      const totalPendingDays = getDaysInPeriod(startCalculo, endCalculo);

      if (totalPendingDays <= 0) continue;

      results.push({
        contractId,
        contractCode: contractCode || 'Sin Código',
        cups: cups || '',
        status,
        lastBilledDate: lastBilledDate ? new Date(lastBilledDate).toISOString() : null,
        annualConsumption: Number(annualConsumption) || 0,
        totalPendingDays,
        totalPendingMWh: totalPendingDays * dailyConsumption,
        m0PendingMWh: daysM0 * dailyConsumption,
        m1PendingMWh: daysM1 * dailyConsumption,
        m2PendingMWh: daysM2 * dailyConsumption,
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
