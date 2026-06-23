import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
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
        MAX(MAX(i."billingEnd")) OVER (PARTITION BY sp."cups") as "lastBilledDate"
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      LEFT JOIN "Invoice" i ON i."contractId" = c.id
      WHERE sp."cups" = 'ES0031105245642001VL0F'
      GROUP BY c.id, sp."cups", sp."annualConsumption"
    `;

    const today = new Date();
    // Use the exact date of "today" as Next.js would see it (right now)
    const m0Start = startOfMonth(today);
    const m0End = endOfMonth(today);
    const m1Start = startOfMonth(subMonths(today, 1));
    const m1End = endOfMonth(subMonths(today, 1));
    const m2Start = startOfMonth(subMonths(today, 2));
    const m2End = endOfMonth(subMonths(today, 2));

    const cupsMaxBilledDate = new Map<string, Date>();

    for (const row of (contractsRaw as any[])) {
      const { cups, airtableData } = row;
      let { lastBilledDate } = row;

      if (!lastBilledDate && airtableData) {
        const airData = typeof airtableData === 'string' ? JSON.parse(airtableData) : airtableData;
        if (airData["ULT DIA FACT"]) {
          lastBilledDate = new Date(airData["ULT DIA FACT"]);
        } else if (airData["ULTIMO DIA FACTURADO"]) {
          lastBilledDate = new Date(airData["ULTIMO DIA FACTURADO"]);
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

    const results: any[] = [];

    for (const row of (contractsRaw as any[])) {
      const { contractId, contractCode, status, activationDate, terminationDate, annualConsumption, cups } = row;
      
      const lastBilledDate = cupsMaxBilledDate.get(cups) || null;
      console.log('lastBilledDate derived:', lastBilledDate);

      const startCalculo = lastBilledDate ? new Date(lastBilledDate) : new Date(activationDate);
      if (lastBilledDate) {
        startCalculo.setDate(startCalculo.getDate() + 1);
      }
      
      const endCalculo = terminationDate ? new Date(terminationDate) : m0End;
      console.log('startCalculo:', startCalculo);
      console.log('endCalculo:', endCalculo);

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

      results.push({
        cups,
        totalPendingDays,
        totalPendingMWh: totalPendingDays * dailyConsumption
      });
    }

    console.log(results);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
