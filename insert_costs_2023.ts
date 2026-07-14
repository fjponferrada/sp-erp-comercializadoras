import { prisma } from './src/lib/prisma';

const data = [
  // CARGOS 2023
  { concept: 'Cargos_Potencia', tariff: '2.0TD', p1: 2.989915, p2: 0.192288, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Cargos_Potencia', tariff: '3.0TD', p1: 3.715217, p2: 1.859231, p3: 1.350774, p4: 1.350774, p5: 1.350774, p6: 0.619203 },
  { concept: 'Cargos_Potencia', tariff: '6.1TD', p1: 3.856557, p2: 1.930027, p3: 1.402384, p4: 1.402384, p5: 1.402384, p6: 0.642759 },
  { concept: 'Cargos_Potencia', tariff: '6.2TD', p1: 2.264702, p2: 1.133557, p3: 0.823528, p4: 0.823528, p5: 0.823528, p6: 0.377450 },
  { concept: 'Cargos_Potencia', tariff: '6.3TD', p1: 1.813304, p2: 0.907425, p3: 0.659281, p4: 0.659281, p5: 0.659281, p6: 0.302217 },
  { concept: 'Cargos_Potencia', tariff: '6.4TD', p1: 0.887008, p2: 0.443874, p3: 0.322548, p4: 0.322548, p5: 0.322548, p6: 0.147835 },
  { concept: 'Cargos_Potencia', tariff: '3.0TDVE', p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Cargos_Potencia', tariff: '6.1TDVE', p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },

  // PEAJES 2023
  { concept: 'Peajes_Potencia', tariff: '2.0TD', p1: 22.393140, p2: 1.150425, p3: 0, p4: 0, p5: 0, p6: 0 },
  { concept: 'Peajes_Potencia', tariff: '3.0TD', p1: 10.267292, p2: 10.039843, p3: 2.651271, p4: 2.303199, p5: 1.381933, p6: 1.381933 },
  { concept: 'Peajes_Potencia', tariff: '6.1TD', p1: 19.108658, p2: 17.911151, p3: 8.925198, p4: 7.158278, p5: 0.506199, p6: 0.506199 },
  { concept: 'Peajes_Potencia', tariff: '6.2TD', p1: 13.561685, p2: 13.526788, p3: 5.420822, p4: 4.094881, p5: 0.374203, p6: 0.374203 },
  { concept: 'Peajes_Potencia', tariff: '6.3TD', p1: 9.880203, p2: 9.471228, p3: 4.796920, p4: 3.592008, p5: 0.487055, p6: 0.487055 },
  { concept: 'Peajes_Potencia', tariff: '6.4TD', p1: 8.443077, p2: 7.279110, p3: 3.590719, p4: 2.751326, p5: 0.349732, p6: 0.349732 },
  { concept: 'Peajes_Potencia', tariff: '3.0TDVE', p1: 2.558984, p2: 2.503926, p3: 0.664441, p4: 0.573622, p5: 0.338303, p6: 0.338303 },
  { concept: 'Peajes_Potencia', tariff: '6.1TDVE', p1: 4.269983, p2: 4.002324, p3: 1.994267, p4: 1.599721, p5: 0.113126, p6: 0.113126 },
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
