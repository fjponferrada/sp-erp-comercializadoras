import { prisma } from './src/lib/prisma';

const data = [
  // CARGOS ENERGIA 2023
  { concept: 'Cargos_Energia', tariff: '2.0TD', p1: 0.043893, p2: 0.008779, p3: 0.002195, p4: null, p5: null, p6: null },
  { concept: 'Cargos_Energia', tariff: '3.0TD', p1: 0.024469, p2: 0.018118, p3: 0.009788, p4: 0.004894, p5: 0.003137, p6: 0.001958 },
  { concept: 'Cargos_Energia', tariff: '6.1TD', p1: 0.013305, p2: 0.009856, p3: 0.005322, p4: 0.002661, p5: 0.001706, p6: 0.001064 },
  { concept: 'Cargos_Energia', tariff: '6.2TD', p1: 0.006243, p2: 0.004624, p3: 0.002497, p4: 0.001249, p5: 0.000800, p6: 0.000499 },
  { concept: 'Cargos_Energia', tariff: '6.3TD', p1: 0.005117, p2: 0.003791, p3: 0.002047, p4: 0.001023, p5: 0.000656, p6: 0.000409 },
  { concept: 'Cargos_Energia', tariff: '6.4TD', p1: 0.001944, p2: 0.001440, p3: 0.000778, p4: 0.000389, p5: 0.000249, p6: 0.000156 },
  { concept: 'Cargos_Energia', tariff: '3.0TDVE', p1: 0.052004, p2: 0.038506, p3: 0.020802, p4: 0.010401, p5: 0.006667, p6: 0.004161 },
  { concept: 'Cargos_Energia', tariff: '6.1TDVE', p1: 0.041886, p2: 0.031028, p3: 0.016755, p4: 0.008377, p5: 0.005371, p6: 0.003350 },

  // PEAJES ENERGIA 2023
  { concept: 'Peajes_Energia', tariff: '2.0TD', p1: 0.029098, p2: 0.019794, p3: 0.000980, p4: null, p5: null, p6: null },
  { concept: 'Peajes_Energia', tariff: '3.0TD', p1: 0.019466, p2: 0.015685, p3: 0.006382, p4: 0.004645, p5: 0.000412, p6: 0.000412 },
  { concept: 'Peajes_Energia', tariff: '6.1TD', p1: 0.018036, p2: 0.014354, p3: 0.005965, p4: 0.004393, p5: 0.000362, p6: 0.000362 },
  { concept: 'Peajes_Energia', tariff: '6.2TD', p1: 0.010719, p2: 0.008707, p3: 0.003427, p4: 0.002349, p5: 0.000172, p6: 0.000172 },
  { concept: 'Peajes_Energia', tariff: '6.3TD', p1: 0.008957, p2: 0.007052, p3: 0.002994, p4: 0.002055, p5: 0.000197, p6: 0.000197 },
  { concept: 'Peajes_Energia', tariff: '6.4TD', p1: 0.008625, p2: 0.006738, p3: 0.002988, p4: 0.001948, p5: 0.000153, p6: 0.000153 },
  { concept: 'Peajes_Energia', tariff: '3.0TDVE', p1: 0.079160, p2: 0.063806, p3: 0.025712, p4: 0.019074, p5: 0.001707, p6: 0.001707 },
  { concept: 'Peajes_Energia', tariff: '6.1TDVE', p1: 0.137450, p2: 0.109389, p3: 0.045493, p4: 0.033456, p5: 0.002758, p6: 0.002758 },
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
