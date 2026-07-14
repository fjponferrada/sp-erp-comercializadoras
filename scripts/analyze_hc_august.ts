import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { differenceInDays } from 'date-fns';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const targetMonthStart = new Date('2025-08-01T00:00:00Z');
  const targetMonthEnd = new Date('2025-08-31T23:59:59Z');

  // Buscar facturas de CUPS de HC (ES0026) que se solapen con agosto 2025
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: comp.id,
      supplyPoint: {
        cups: { startsWith: 'ES0026' }
      },
      billingStart: { lte: targetMonthEnd },
      billingEnd: { gte: targetMonthStart },
    }
  });

  let totalMWhImputables = 0;
  let countFacturas = 0;

  for (const inv of invoices) {
    // Fechas de la factura
    const invStart = inv.billingStart;
    const invEnd = inv.billingEnd;

    // Intersección con agosto
    const overlapStart = invStart < targetMonthStart ? targetMonthStart : invStart;
    const overlapEnd = invEnd > targetMonthEnd ? targetMonthEnd : invEnd;

    const overlapDays = differenceInDays(overlapEnd, overlapStart) + 1;
    const totalDays = differenceInDays(invEnd, invStart) + 1;

    if (overlapDays > 0 && totalDays > 0) {
      // Recuerda que la DB guarda kWh en totalMWh
      let rawMWh = inv.totalMWh / 1000;
      if (inv.invoiceType?.toLowerCase().includes('abono')) {
        rawMWh = -Math.abs(rawMWh);
      } else {
        rawMWh = Math.abs(rawMWh);
      }

      const proratedMWh = (rawMWh / totalDays) * overlapDays;
      totalMWhImputables += proratedMWh;
      countFacturas++;
    }
  }

  console.log(`CUPS de Hidrocantábrico (ES0026) solapados con Agosto 2025`);
  console.log(`Número de facturas encontradas: ${countFacturas}`);
  console.log(`Energía imputable a Agosto 2025: ${totalMWhImputables.toFixed(2)} MWh`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
