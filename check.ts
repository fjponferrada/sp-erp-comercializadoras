import { prisma } from './src/lib/prisma';

async function check() {
  const f1s = await prisma.f1Invoice.findMany({
    take: 5,
    include: { supplyPoint: true }
  });
  
  for(const f1 of f1s) {
      if(!f1.supplyPoint) continue;
      const cups = f1.supplyPoint.cups;
      
      const lcCount = await prisma.loadCurve.count({ where: { cups: cups } });
      
      // Let's check without the last 2 digits (which might be the checksum in some systems)
      const baseCups = cups.substring(0, 20);
      const lcCountLike = await prisma.loadCurve.count({ where: { cups: { startsWith: baseCups } } });
      
      console.log(`F1 CUPS: ${cups} | Exact: ${lcCount} | StartsWith(20): ${lcCountLike}`);
      
      // If we find any in the DB at all
      const anyLc = await prisma.loadCurve.findFirst({});
      console.log(`Any LC in DB? ${anyLc?.cups || 'No'}`);
  }
}
check().finally(() => prisma.$disconnect());
