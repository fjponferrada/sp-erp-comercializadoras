import { prisma } from './src/lib/prisma';

const data = [
  // PAGOS CAPACIDAD 2023
  { concept: 'Pagos_Capacidad', tariff: '2.0TD', p1: 0.001068, p2: 0.000178, p3: null, p4: null, p5: null, p6: null },
  { concept: 'Pagos_Capacidad', tariff: '3.0TD', p1: 0.001443, p2: 0.000667, p3: 0.000444, p4: 0.000333, p5: 0.000333, p6: 0.000000 },
  { concept: 'Pagos_Capacidad', tariff: '6.1TD', p1: 0.000619, p2: 0.000285, p3: 0.000190, p4: 0.000143, p5: 0.000143, p6: 0.000000 },
  { concept: 'Pagos_Capacidad', tariff: '6.2TD', p1: 0.000619, p2: 0.000285, p3: 0.000190, p4: 0.000143, p5: 0.000143, p6: 0.000000 },
  { concept: 'Pagos_Capacidad', tariff: '6.3TD', p1: 0.000619, p2: 0.000285, p3: 0.000190, p4: 0.000143, p5: 0.000143, p6: 0.000000 },
  { concept: 'Pagos_Capacidad', tariff: '6.4TD', p1: 0.000619, p2: 0.000285, p3: 0.000190, p4: 0.000143, p5: 0.000143, p6: 0.000000 },
  { concept: 'Pagos_Capacidad', tariff: '3.0TDVE', p1: 0.001443, p2: 0.000667, p3: 0.000444, p4: 0.000333, p5: 0.000333, p6: 0.000000 },
  { concept: 'Pagos_Capacidad', tariff: '6.1TDVE', p1: 0.000619, p2: 0.000285, p3: 0.000190, p4: 0.000143, p5: 0.000143, p6: 0.000000 },

  // PAGO OM / OS 2023 (en todos los periodos, TODAS las tarifas)
  { concept: 'Pago_OM', tariff: 'TODAS', p1: 0.03702, p2: 0.03702, p3: 0.03702, p4: 0.03702, p5: 0.03702, p6: 0.03702 },
  { concept: 'Pago_OS', tariff: 'TODAS', p1: 0.15971, p2: 0.15971, p3: 0.15971, p4: 0.15971, p5: 0.15971, p6: 0.15971 },
];

async function main() {
  const validFrom = new Date('2023-01-01T00:00:00.000Z');
  const validTo = new Date('2023-12-31T23:59:59.999Z');

  for (const item of data) {
    const existing = await prisma.regulatedCost.findFirst({
      where: {
        concept: item.concept,
        tariff: item.tariff,
        validFrom,
        validTo
      }
    });

    if (existing) {
      console.log(`Already exists: ${item.concept} ${item.tariff}`);
      continue;
    }

    await prisma.regulatedCost.create({
      data: {
        concept: item.concept,
        tariff: item.tariff,
        validFrom,
        validTo,
        p1: item.p1,
        p2: item.p2,
        p3: item.p3,
        p4: item.p4,
        p5: item.p5,
        p6: item.p6
      }
    });
    console.log(`Inserted: ${item.concept} ${item.tariff}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
