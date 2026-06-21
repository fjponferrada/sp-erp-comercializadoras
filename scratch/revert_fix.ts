import { prisma } from '../src/lib/prisma';

async function main() {
  const startTime = new Date('2026-06-20T17:10:00.000Z');
  const endTime = new Date('2026-06-20T17:12:00.000Z');

  const contracts = await prisma.contract.findMany({
    where: {
      updatedAt: {
        gte: startTime,
        lte: endTime
      }
    }
  });

  let reverted = 0;
  for (const c of contracts) {
    await prisma.contract.update({
      where: { id: c.id },
      data: { commissionFinal: 0 }
    });
    reverted++;
  }

  console.log(`Reverted commissionFinal to 0 for ${reverted} contracts updated during the script window.`);
}

main().finally(() => prisma.$disconnect());
