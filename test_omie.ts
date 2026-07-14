import { prisma } from './src/lib/prisma';

async function main() {
  const data = await prisma.esiosIndicatorData.findMany({
    where: {
      date: {
        gte: new Date('2026-06-02T20:00:00Z'),
        lte: new Date('2026-06-03T10:00:00Z')
      },
      indicatorId: 600 // OMIE
    },
    orderBy: { date: 'asc' }
  });

  data.forEach(d => console.log(`${d.date.toISOString()} -> OMIE: ${d.value}`));
}

main().catch(console.error).finally(() => process.exit(0));
