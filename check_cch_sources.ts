import { prisma } from './src/lib/prisma';

async function main() {
  const cchs = await prisma.loadCurve.findMany({
    select: { source: true, type: true },
    distinct: ['source', 'type']
  });

  console.log("Distinct sources and types in LoadCurve:");
  for (const cch of cchs) {
    console.log(`${cch.source} -> ${cch.type}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
