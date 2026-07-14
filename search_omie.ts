import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const prices = await prisma.systemComponentPrice.findMany({
    where: { component: 'OMIE' },
    orderBy: { date: 'asc' }
  });

  for (const p of prices) {
    const v = p.values;
    // Look for sequence: 9.17, 7.49, 7.06
    if (v.includes(9.17) || v.includes(7.49) || v.includes(7.06) || v.includes(5.59) || v.includes(5.41)) {
       console.log(`Found in ${p.date.toISOString()}:`);
       console.log(v.slice(0, 10));
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
