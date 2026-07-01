import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function seedVE() {
  const boe = [
    { t: '3.0TDVE', p1: 16.6, p2: 17.5, p3: 16.5, p4: 16.5, p5: 13.8, p6: 18.0 },
    { t: '6.1TDVE', p1: 6.7, p2: 6.8, p3: 6.5, p4: 6.5, p5: 4.3, p6: 7.7 }
  ];

  for (const b of boe) {
    const existing = await prisma.regulatedCost.findFirst({
      where: { concept: 'PERDIDAS', tariff: b.t }
    });
    
    if (!existing) {
      await prisma.regulatedCost.create({
        data: {
          concept: 'PERDIDAS',
          tariff: b.t,
          validFrom: new Date('2020-01-01T00:00:00Z'),
          validTo: new Date('2099-12-31T23:59:59Z'),
          p1: b.p1, p2: b.p2, p3: b.p3, p4: b.p4, p5: b.p5, p6: b.p6
        }
      });
      console.log('Inserted ' + b.t);
    } else {
      console.log(b.t + ' already exists');
    }
  }
}

seedVE().finally(() => prisma.$disconnect());
