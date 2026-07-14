import { prisma } from './src/lib/prisma';

async function main() {
  const data = await prisma.esiosIndicatorData.findFirst({
    where: {
      date: {
        gte: new Date('2026-06-01T00:00:00Z')
      }
    }
  });

  console.log("ESIOS data sample:", data);
}

main().catch(console.error).finally(() => process.exit(0));
