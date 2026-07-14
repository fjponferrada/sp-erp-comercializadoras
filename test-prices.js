const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const futureJuly = await prisma.futurePrice.findFirst({
    where: { month: 202607 }
  });
  console.log("Future Price July 2026:", futureJuly);

  const futureAug = await prisma.futurePrice.findFirst({
    where: { month: 202608 }
  });
  console.log("Future Price Aug 2026:", futureAug);

  // Average of PortfolioBaseCurve for July 2026
  const curve = await prisma.portfolioBaseCurve.findMany({
    where: {
      datetime: {
        gte: new Date('2026-07-01T00:00:00Z'),
        lt: new Date('2026-08-01T00:00:00Z')
      }
    }
  });

  if (curve.length > 0) {
    let sum = 0;
    let daySum = 0;
    let dayCount = 0;
    for (const c of curve) {
      sum += c.omiePriceEurMwh;
      const h = c.datetime.getUTCHours();
      if (h >= 10 && h <= 18) {
        daySum += c.omiePriceEurMwh;
        dayCount++;
      }
    }
    console.log("Portfolio Average July 2026:", sum / curve.length);
    console.log("Portfolio Average Day Hours (10-18) July 2026:", daySum / dayCount);
  } else {
    console.log("No curve found for July 2026");
  }

  // Same for August
  const curveAug = await prisma.portfolioBaseCurve.findMany({
    where: {
      datetime: {
        gte: new Date('2026-08-01T00:00:00Z'),
        lt: new Date('2026-09-01T00:00:00Z')
      }
    }
  });

  if (curveAug.length > 0) {
    let sum = 0;
    let daySum = 0;
    let dayCount = 0;
    for (const c of curveAug) {
      sum += c.omiePriceEurMwh;
      const h = c.datetime.getUTCHours();
      if (h >= 10 && h <= 18) {
        daySum += c.omiePriceEurMwh;
        dayCount++;
      }
    }
    console.log("Portfolio Average Aug 2026:", sum / curveAug.length);
    console.log("Portfolio Average Day Hours (10-18) Aug 2026:", daySum / dayCount);
  } else {
    console.log("No curve found for Aug 2026");
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
