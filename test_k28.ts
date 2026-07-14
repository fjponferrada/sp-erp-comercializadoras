import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const prices = await prisma.systemComponentPrice.findMany({
    where: {
      date: new Date('2026-03-28'),
      component: 'K'
    }
  });

  console.log('K factor on March 28:', prices[0]?.values);
}
check().finally(() => prisma.$disconnect());
