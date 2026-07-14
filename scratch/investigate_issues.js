const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== ISSUE 1: ERANOVUM CONTRATOS FIJOS ===");
  const invoices = await prisma.f1Invoice.findMany({
    where: {
      contract: {
        client: {
          businessName: { contains: 'ERANOVUM' }
        }
      }
    },
    include: {
      contract: { include: { supplyPoint: true } }
    }
  });

  for (const inv of invoices) {
    const isFixed = inv.contract.pricingModel === 'FIJO' || (inv.jsonData && inv.jsonData['AirTable FIJO/INDEX'] === 'F');
    if (isFixed) {
      console.log(`CUPS: ${inv.contract?.supplyPoint?.cups}`);
      console.log(`pricingModel: ${inv.contract.pricingModel}`);
      console.log(`AirTable FIJO/INDEX: ${inv.jsonData ? inv.jsonData['AirTable FIJO/INDEX'] : 'undefined'}`);
    }
  }

  console.log("\n=== ISSUE 2: ES0031105643212001CLAF CURVAS ===");
  const curves = await prisma.loadCurve.findMany({
    where: {
      cups: { startsWith: 'ES0031105643212001' },
      date: {
        gte: new Date('2026-06-01T00:00:00Z'),
        lte: new Date('2026-07-02T00:00:00Z')
      }
    },
    orderBy: { date: 'asc' }
  });

  console.log(`Found ${curves.length} curve records`);
  if (curves.length > 0) {
    console.log(`First curve date: ${curves[0].date}`);
    console.log(`Last curve date: ${curves[curves.length-1].date}`);
    console.log(`Total energy in curves: ${curves.reduce((acc, c) => acc + (c.totalEnergy || 0), 0)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
