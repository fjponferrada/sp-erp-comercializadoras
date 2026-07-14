import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { differenceInDays } from 'date-fns';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const startStr = '2025-08-01T00:00:00Z';
  const endStr = '2025-08-31T23:59:59Z';
  const targetMonthStart = new Date(startStr);
  const targetMonthEnd = new Date(endStr);

  // 1. Total Invoiced Energy (prorated)
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: comp.id,
      billingStart: { lte: targetMonthEnd },
      billingEnd: { gte: targetMonthStart },
    },
    include: {
      supplyPoint: {
        select: { cups: true }
      }
    }
  });

  let invoicedByDist = new Map<string, number>();
  let totalInvoiced = 0;

  for (const inv of invoices) {
    const invStart = inv.billingStart;
    const invEnd = inv.billingEnd;
    const overlapStart = invStart! < targetMonthStart ? targetMonthStart : invStart!;
    const overlapEnd = invEnd! > targetMonthEnd ? targetMonthEnd : invEnd!;
    const overlapDays = differenceInDays(overlapEnd, overlapStart) + 1;
    const totalDays = differenceInDays(invEnd!, invStart!) + 1;

    if (overlapDays > 0 && totalDays > 0) {
      let rawMWh = inv.totalMWh / 1000;
      if (inv.invoiceType?.toLowerCase().includes('abono')) rawMWh = -Math.abs(rawMWh);
      else rawMWh = Math.abs(rawMWh);
      const proratedMWh = (rawMWh / totalDays) * overlapDays;
      
      const distId = inv.supplyPoint?.cups?.substring(0,6) || 'UNKNOWN';
      invoicedByDist.set(distId, (invoicedByDist.get(distId) || 0) + proratedMWh);
      totalInvoiced += proratedMWh;
    }
  }

  // 2. Total CCH Energy (AggregatedLoadCurve)
  const curves = await prisma.aggregatedLoadCurve.findMany({
    where: {
      companyId: comp.id,
      date: { gte: targetMonthStart, lte: targetMonthEnd }
    }
  });

  // We can't easily group CCH by distributor from aggregated curves, 
  // but we can check the totals.
  let totalCch = 0;
  for (const curve of curves) {
    totalCch += curve.totalConsumptionKwh / 1000;
  }

  console.log(`=== AGOSTO 2025 ===`);
  console.log(`Total Energía Facturada a clientes (Prorrateada): ${totalInvoiced.toFixed(2)} MWh`);
  console.log(`Total Energía CCH Sumada (Sin pérdidas): ${totalCch.toFixed(2)} MWh`);
  console.log(`Diferencia global (Facturado - CCH): ${(totalInvoiced - totalCch).toFixed(2)} MWh`);
  console.log(`\nDesglose Facturado por Prefijo CUPS:`);
  for (const [dist, mwh] of invoicedByDist.entries()) {
    console.log(` - ${dist}: ${mwh.toFixed(2)} MWh`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
