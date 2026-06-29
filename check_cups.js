const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const f1s = await prisma.f1Invoice.findMany({
    take: 5,
    include: { supplyPoint: true }
  });
  
  for(const f1 of f1s) {
      if(!f1.supplyPoint) continue;
      const cups = f1.supplyPoint.cups;
      const lcCount = await prisma.loadCurve.count({ where: { cups: cups } });
      const lcCountLike = await prisma.loadCurve.count({ where: { cups: { contains: cups.substring(0, 20) } } });
      console.log(`F1 CUPS: ${cups} | Exact Matches: ${lcCount} | Like Matches (first 20): ${lcCountLike}`);
  }
}
check().finally(() => prisma.$disconnect());
