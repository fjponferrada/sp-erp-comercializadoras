import { prisma } from './src/lib/prisma';

async function main() {
  const baseCups = 'ES0021000013147731TP';
  const curves = await prisma.loadCurve.findMany({
    where: {
      cups: { startsWith: baseCups }
    },
    select: { cups: true, date: true }
  });
  
  const uniqueCups = [...new Set(curves.map(c => c.cups))];
  console.log("Unique CUPS in LoadCurve:", uniqueCups);
}

main().catch(console.error).finally(() => process.exit(0));
