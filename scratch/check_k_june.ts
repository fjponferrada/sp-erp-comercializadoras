import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const kJune = await prisma.systemComponentPrice.count({
    where: {
      component: 'K',
      date: {
        gte: new Date('2026-06-01T00:00:00Z'),
        lt: new Date('2026-07-01T00:00:00Z')
      }
    }
  });

  const kJuly = await prisma.systemComponentPrice.count({
    where: {
      component: 'K',
      date: {
        gte: new Date('2026-07-01T00:00:00Z'),
        lt: new Date('2026-08-01T00:00:00Z')
      }
    }
  });

  const kMay = await prisma.systemComponentPrice.count({
    where: {
      component: 'K',
      date: {
        gte: new Date('2026-05-01T00:00:00Z'),
        lt: new Date('2026-06-01T00:00:00Z')
      }
    }
  });

  console.log({ may: kMay, june: kJune, july: kJuly });
}

main().catch(console.error).finally(() => prisma.$disconnect());
