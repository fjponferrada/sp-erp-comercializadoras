import { prisma } from '@/lib/prisma';

async function main() {
  const lc = await prisma.loadCurve.findFirst({
    where: {
      cups: { startsWith: 'ES0031405446869086QD0F' },
      date: {
        gte: new Date('2026-06-01T00:00:00Z'),
        lt: new Date('2026-07-01T00:00:00Z')
      }
    }
  });

  if (lc) {
    console.log("Found LoadCurve:", {
      cups: lc.cups,
      date: lc.date,
      source: lc.source,
      isProvisional: lc.isProvisional,
      resolution: lc.resolution
    });
  } else {
    console.log("No LoadCurve found for this CUPS in June 2026.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
