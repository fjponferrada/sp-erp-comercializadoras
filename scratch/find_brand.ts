import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const allCompanies = await prisma.company.findMany({
    include: { brands: true }
  });

  for (const c of allCompanies) {
    if (c.cie === 'ES00014L3007C') {
      console.log(`FOUND Company ID: ${c.id}`);
      for (const b of c.brands) {
        console.log(`  -> Brand ID: ${b.id}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
