import { prisma } from './src/lib/prisma';
import * as fs from 'fs';

async function main() {
  const inv = await prisma.f1Invoice.findFirst({
    where: {
      supplyPoint: { cups: { contains: 'ES0021000013147731TP' } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!inv) return;
  fs.writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/5625170d-673a-471a-b1f3-7e5874175dbc/scratch/f1_excedentes.json', JSON.stringify(inv.jsonData, null, 2));
  console.log("F1 JSON dumped.");
}

main().catch(console.error).finally(() => process.exit(0));
