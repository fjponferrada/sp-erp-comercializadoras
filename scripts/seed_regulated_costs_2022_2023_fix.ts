import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const regulated2022 = [
  // PEAJES POTENCIA 2022 (€/kW/año - Resolución CNMC 16/12/2021)
  { concept: 'Peajes_Potencia', tariff: '2.0TD', p1: 22.988256, p2: 0.938907, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Peajes_Potencia', tariff: '3.0TD', p1: 10.492662, p2: 9.152291, p3: 3.688055, p4: 2.802282, p5: 1.122376, p6: 1.122376 },
  { concept: 'Peajes_Potencia', tariff: '3.0TDVE', p1: 2.600765, p2: 2.266264, p3: 0.915907, p4: 0.696758, p5: 0.274140, p6: 0.274140 },
  { concept: 'Peajes_Potencia', tariff: '6.1TD', p1: 18.319843, p2: 18.320411, p3: 9.988101, p4: 7.565419, p5: 0.502080, p6: 0.502080 },

  // CARGOS POTENCIA 2022 (€/kW/año - Orden TED/371/2022 / RDL 6/2022)
  { concept: 'Cargos_Potencia', tariff: '2.0TD', p1: 3.176039, p2: 0.204273, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Cargos_Potencia', tariff: '3.0TD', p1: 3.947437, p2: 1.975014, p3: 1.435204, p4: 1.435204, p5: 1.435204, p6: 0.658153 },
  { concept: 'Cargos_Potencia', tariff: '3.0TDVE', p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Cargos_Potencia', tariff: '6.1TD', p1: 4.097267, p2: 2.050404, p3: 1.490036, p4: 1.490036, p5: 1.490036, p6: 0.683188 },

  // PEAJES ENERGÍA 2022 (€/kWh - Resolución CNMC 16/12/2021)
  { concept: 'Peajes_Energia', tariff: '2.0TD', p1: 0.027787, p2: 0.018762, p3: 0.000703, p4: 0, p5: 0, p6: 0 },
  { concept: 'Peajes_Energia', tariff: '3.0TD', p1: 0.018772, p2: 0.014987, p3: 0.006377, p4: 0.004628, p5: 0.000405, p6: 0.000405 },
  { concept: 'Peajes_Energia', tariff: '3.0TDVE', p1: 0.077250, p2: 0.061680, p3: 0.026245, p4: 0.019047, p5: 0.001667, p6: 0.001667 },
  { concept: 'Peajes_Energia', tariff: '6.1TD', p1: 0.016863, p2: 0.013361, p3: 0.005757, p4: 0.004198, p5: 0.000338, p6: 0.000338 },

  // CARGOS ENERGÍA 2022 (€/kWh - Orden TED/371/2022 / RDL 6/2022)
  { concept: 'Cargos_Energia', tariff: '2.0TD', p1: 0.046622, p2: 0.009324, p3: 0.002331, p4: 0, p5: 0, p6: 0 },
  { concept: 'Cargos_Energia', tariff: '3.0TD', p1: 0.025990, p2: 0.019244, p3: 0.010396, p4: 0.005198, p5: 0.003332, p6: 0.002080 },
  { concept: 'Cargos_Energia', tariff: '3.0TDVE', p1: 0.055236, p2: 0.040899, p3: 0.022095, p4: 0.011047, p5: 0.007082, p6: 0.004420 },
  { concept: 'Cargos_Energia', tariff: '6.1TD', p1: 0.014132, p2: 0.010468, p3: 0.005653, p4: 0.002826, p5: 0.001812, p6: 0.001131 },

  // PAGOS POR CAPACIDAD 2022 (€/kWh)
  { concept: 'Pagos_Capacidad', tariff: '2.0TD', p1: 0.001068, p2: 0.000178, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Pagos_Capacidad', tariff: '3.0TD', p1: 0.001443, p2: 0.000667, p3: 0.000444, p4: 0.000333, p5: 0.000333, p6: 0 },
  { concept: 'Pagos_Capacidad', tariff: '3.0TDVE', p1: 0.001443, p2: 0.000667, p3: 0.000444, p4: 0.000333, p5: 0.000333, p6: 0 },
  { concept: 'Pagos_Capacidad', tariff: '6.1TD', p1: 0.000619, p2: 0.000285, p3: 0.000190, p4: 0.000143, p5: 0.000143, p6: 0 },

  // FNEE, PAGO OS, PAGO OM 2022 (€/kWh)
  { concept: 'FNEE', tariff: 'TODAS', p1: 0.00019777, p2: 0.00019777, p3: 0.00019777, p4: 0.00019777, p5: 0.00019777, p6: 0.00019777 },
  { concept: 'Pago_OS', tariff: 'TODAS', p1: 0.00013863, p2: 0.00013863, p3: 0.00013863, p4: 0.00013863, p5: 0.00013863, p6: 0.00013863 },
  { concept: 'Pago_OM', tariff: 'TODAS', p1: 0.00003377, p2: 0.00003377, p3: 0.00003377, p4: 0.00003377, p5: 0.00003377, p6: 0.00003377 },
];

async function main() {
  const validFrom2022 = new Date('2022-01-01T00:00:00.000Z');
  const validTo2022 = new Date('2022-12-31T23:59:59.999Z');

  let inserted2022 = 0;
  for (const item of regulated2022) {
    const existing = await prisma.regulatedCost.findFirst({
      where: { concept: item.concept, tariff: item.tariff, validFrom: validFrom2022 }
    });
    if (existing) {
      await prisma.regulatedCost.update({
        where: { id: existing.id },
        data: { validTo: validTo2022, p1: item.p1, p2: item.p2, p3: item.p3, p4: item.p4, p5: item.p5, p6: item.p6 }
      });
    } else {
      await prisma.regulatedCost.create({
        data: {
          concept: item.concept,
          tariff: item.tariff,
          validFrom: validFrom2022,
          validTo: validTo2022,
          p1: item.p1,
          p2: item.p2,
          p3: item.p3,
          p4: item.p4,
          p5: item.p5,
          p6: item.p6
        }
      });
      inserted2022++;
    }
  }
  console.log(`✅ RegulatedCost 2022 sincronizados (${inserted2022} nuevos).`);

  // Fix 2023 TODAS Pago_OS & Pago_OM unit scale (€/MWh -> €/kWh) & ensure 2023 FNEE exists
  const validFrom2023 = new Date('2023-01-01T00:00:00.000Z');
  const validTo2023 = new Date('2023-12-31T23:59:59.999Z');

  await prisma.regulatedCost.updateMany({
    where: { tariff: 'TODAS', concept: 'Pago_OS', validFrom: validFrom2023, p1: { gt: 0.01 } },
    data: { p1: 0.00015971, p2: 0.00015971, p3: 0.00015971, p4: 0.00015971, p5: 0.00015971, p6: 0.00015971 }
  });
  await prisma.regulatedCost.updateMany({
    where: { tariff: 'TODAS', concept: 'Pago_OM', validFrom: validFrom2023, p1: { gt: 0.01 } },
    data: { p1: 0.00003702, p2: 0.00003702, p3: 0.00003702, p4: 0.00003702, p5: 0.00003702, p6: 0.00003702 }
  });
  const fnee2023 = await prisma.regulatedCost.findFirst({
    where: { concept: 'FNEE', validFrom: validFrom2023 }
  });
  if (!fnee2023) {
    await prisma.regulatedCost.create({
      data: {
        concept: 'FNEE',
        tariff: 'TODAS',
        validFrom: validFrom2023,
        validTo: validTo2023,
        p1: 0.00024379,
        p2: 0.00024379,
        p3: 0.00024379,
        p4: 0.00024379,
        p5: 0.00024379,
        p6: 0.00024379
      }
    });
  }
  console.log('✅ RegulatedCost 2023 (Pago_OS, Pago_OM en €/kWh y FNEE) saneados.');

  // Fix one-off "Alta Nueva (25 €/alta)" SVA contracts that had svaDuration = 120 instead of 1
  const fixedAltaSva = await prisma.contract.updateMany({
    where: {
      svaConcept: { contains: '€/alta', mode: 'insensitive' },
      svaDuration: { gt: 1 }
    },
    data: { svaDuration: 1 }
  });
  console.log(`✅ Contratos con SVA pago único (€/alta) corregidos a duración 1 mes: ${fixedAltaSva.count}`);

  // Fix ERANOVUM BOE Index contracts where migration copied generic product fee (9 or 15) / dsv (5) instead of agreed 7 / 2.5
  const eranovumProd = await prisma.product.findFirst({ where: { name: 'ERANOVUM BOE Index' } });
  if (eranovumProd) {
    const fixedEranovum = await prisma.contract.updateMany({
      where: {
        productId: eranovumProd.id,
        fee: { in: [9, 15] }
      },
      data: {
        fee: 7,
        deviationCost: 2.5
      }
    });
    console.log(`✅ Contratos ERANOVUM BOE Index sincronizados a FEE=7 / DSV=2.5: ${fixedEranovum.count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
