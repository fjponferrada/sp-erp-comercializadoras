import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { differenceInDays } from 'date-fns';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const targetMonthStart = new Date('2025-08-01T00:00:00Z');
  const targetMonthEnd = new Date('2025-08-31T23:59:59Z');

  console.log('Buscando facturas de Agosto 2025...');
  // 1. Get all invoices overlapping August 2025
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: comp.id,
      billingStart: { lte: targetMonthEnd },
      billingEnd: { gte: targetMonthStart },
    },
    include: {
      supplyPoint: { select: { cups: true } }
    }
  });

  const invoicedByCups = new Map<string, number>();

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
      
      const cups = inv.supplyPoint?.cups;
      if (cups) {
        invoicedByCups.set(cups, (invoicedByCups.get(cups) || 0) + proratedMWh);
      }
    }
  }

  console.log(`Analizando CCH de ${invoicedByCups.size} CUPS distintos...`);

  // 2. For each CUPS, sum their HourlyConsumption in August 2025
  const results = [];
  let totalMissingMWh = 0;

  for (const [cups, invoicedMwh] of invoicedByCups.entries()) {
    // Only check CUPS with meaningful invoiced energy (> 0.1 MWh)
    if (invoicedMwh < 0.1) continue;

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: { startsWith: cups.substring(0, 20) },
        date: { gte: targetMonthStart, lte: targetMonthEnd }
      }
    });

    let cchKwh = 0;
    for (const curve of loadCurves) {
      if (Array.isArray(curve.readings)) {
        cchKwh += curve.readings.reduce((sum, val) => sum + (val || 0), 0);
      }
    }
    
    const cchMwh = cchKwh / 1000;
    const daysCount = loadCurves.length;

    // If CCH is severely lower than Invoiced (e.g. less than 50% or missing entirely)
    if (cchMwh < invoicedMwh * 0.5) {
      results.push({
        cups,
        invoicedMwh,
        cchMwh,
        daysCount,
        missingMwh: invoicedMwh - cchMwh
      });
      totalMissingMWh += (invoicedMwh - cchMwh);
    }
  }

  // Sort by biggest missing MWh
  results.sort((a, b) => b.missingMwh - a.missingMwh);

  console.log(`\n=== CUPS CON CURVAS FALTANTES EN AGOSTO 2025 ===`);
  for (const res of results.slice(0, 30)) { // top 30
    console.log(`${res.cups} | Facturado: ${res.invoicedMwh.toFixed(2)} MWh | CCH: ${res.cchMwh.toFixed(2)} MWh | Días CCH: ${res.daysCount} | Diferencia: ${res.missingMwh.toFixed(2)} MWh`);
  }

  const byDistributor = new Map<string, number>();
  for (const res of results) {
    const dist = res.cups.substring(0, 6);
    byDistributor.set(dist, (byDistributor.get(dist) || 0) + res.missingMwh);
  }

  console.log(`\n=== DESGLOSE POR DISTRIBUIDORA ===`);
  for (const [dist, sum] of byDistributor.entries()) {
    console.log(`${dist}: ${sum.toFixed(2)} MWh`);
  }

  console.log(`\nTotal de MWh facturados que NO tienen CCH (o están incompletas): ${totalMissingMWh.toFixed(2)} MWh`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
