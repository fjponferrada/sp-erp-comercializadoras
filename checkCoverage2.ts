import { prisma } from './src/lib/prisma';

async function run() {
  const comp = await prisma.company.findFirst({ where: { name: { contains: 'AED' } } });
  
  const sps = await prisma.supplyPoint.findMany({
    where: { client: { is: { brand: { is: { companyId: comp!.id } } } } },
    select: { cups: true }
  });
  
  // Cut to 20 chars
  const allCups20 = new Set(sps.map(sp => sp.cups.substring(0, 20)));
  
  const curves = await prisma.loadCurve.findMany({
    where: { date: new Date('2026-01-15T00:00:00.000Z') },
    select: { cups: true }
  });
  
  const curveCups20 = new Set(curves.map(c => c.cups.substring(0, 20)));
  
  let missing = 0;
  for (const cups of allCups20) {
    if (!curveCups20.has(cups)) {
      missing++;
    }
  }
  
  console.log(`AED CUPS (20 chars) without LoadCurve: ${missing}`);
  console.log(`Coverage: ${(( (allCups20.size - missing) / allCups20.size) * 100).toFixed(2)}%`);
}

run().finally(() => prisma.$disconnect());
