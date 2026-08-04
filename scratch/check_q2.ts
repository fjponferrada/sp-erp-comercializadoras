import { prisma } from '../src/lib/prisma';
import fs from 'fs';

async function run() {
  try {
    const startDate = new Date("2026-04-01T00:00:00.000Z");
    const endDate = new Date("2026-06-01T00:00:00.000Z"); // up to May 31

    const invoices = await prisma.invoice.findMany({
      where: {
        issueDate: {
          gte: startDate,
          lt: endDate,
        },
        invoiceType: { in: ['FACTURA', 'ABONO'] }
      },
      include: {
        supplyPoint: true
      }
    });

    let counts: any = {};

    for (const inv of invoices) {
      if (inv.subtotal1 === 0) continue;
      
      const taxPct = inv.taxPercentage !== null ? Number(inv.taxPercentage) : 0;
      let tax = Number(inv.taxAmount) || 0;
      let amount = Number(inv.subtotal1) || 0;
      
      if (inv.invoiceType === 'ABONO') {
        tax = -Math.abs(tax);
        amount = -Math.abs(amount);
      }

      if (!counts[taxPct]) {
        counts[taxPct] = { count: 0, taxSum: 0, baseSum: 0 };
      }
      
      counts[taxPct].count++;
      counts[taxPct].taxSum += tax;
      counts[taxPct].baseSum += amount;
    }

    console.log("Breakdown for April - May:");
    for (const pct in counts) {
      console.log(`Tax Pct: ${pct}% -> Count: ${counts[pct].count}, Base: ${counts[pct].baseSum.toFixed(2)} €, Tax: ${counts[pct].taxSum.toFixed(2)} €`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
