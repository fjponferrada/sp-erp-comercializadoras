import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { differenceInDays } from 'date-fns';

async function checkMayEnergy() {
  const targetMonthStart = new Date('2026-05-01T00:00:00Z');
  const targetMonthEnd = new Date('2026-05-31T23:59:59Z');

  // Find all invoices that overlap with May 2026
  const invoices = await prisma.invoice.findMany({
    where: {
      billingStart: { lte: targetMonthEnd },
      billingEnd: { gte: targetMonthStart },
      // Only for commercializadoras, maybe just exclude distributor F1s? 
      // F1Invoice is a separate table, but Invoice is for clients.
    },
    select: {
      invoiceNumber: true,
      invoiceType: true,
      billingStart: true,
      billingEnd: true,
      totalMWh: true,
    }
  });

  let totalImputableMWh = 0;
  let abonoMWh = 0;
  let facturaMWh = 0;

  for (const inv of invoices) {
    if (!inv.billingStart || !inv.billingEnd) continue;

    const start = inv.billingStart < targetMonthStart ? targetMonthStart : inv.billingStart;
    const end = inv.billingEnd > targetMonthEnd ? targetMonthEnd : inv.billingEnd;

    const overlapDays = differenceInDays(end, start) + 1; // +1 to include both ends
    const totalDays = differenceInDays(inv.billingEnd, inv.billingStart) + 1;

    if (overlapDays > 0 && totalDays > 0) {
      let rawMWh = inv.totalMWh;
      if (inv.invoiceType?.toLowerCase().includes('abono')) {
        rawMWh = -Math.abs(rawMWh);
      } else {
        rawMWh = Math.abs(rawMWh);
      }

      const proratedMWh = (rawMWh / totalDays) * overlapDays;
      totalImputableMWh += proratedMWh;

      if (rawMWh < 0) {
        abonoMWh += proratedMWh;
      } else {
        facturaMWh += proratedMWh;
      }
    }
  }

  console.log(`Total facturas encontradas cruzando Mayo: ${invoices.length}`);
  console.log(`Facturado (Positivo): ${facturaMWh.toFixed(2)} MWh`);
  console.log(`Abonado (Negativo): ${abonoMWh.toFixed(2)} MWh`);
  console.log(`TOTAL IMPUTABLE A MAYO 2026: ${totalImputableMWh.toFixed(2)} MWh`);

  // Also query the aggregated demand for May just to double check
  const aggregatedCurves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: {
        gte: targetMonthStart,
        lte: targetMonthEnd
      }
    }
  });

  let bcMwh = 0;
  for (const curve of aggregatedCurves) {
    for (let h = 0; h < 24; h++) {
      if (curve.totalConsumption[h]) {
        // Need to add losses? Let's just output pure consumption first
        bcMwh += curve.totalConsumption[h] / 1000; 
      }
    }
  }
  
  console.log(`Consumo PURO sumado de curvas (sin perdidas) en Mayo: ${bcMwh.toFixed(2)} MWh`);
}

checkMayEnergy().catch(console.error).finally(() => prisma.$disconnect());
