import { prisma } from './src/lib/prisma';
import fs from 'fs';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { id: "cmqlldzcv00047841wcchb24j" }
  });
  
  if (!f1) return;
  fs.writeFileSync('f1_8_data.json', JSON.stringify({
    totalAmount: f1.totalAmount,
    baseImponible: f1.baseImponible,
    totalPeajes: f1.totalPeajes,
    totalCargos: f1.totalCargos,
    fee: f1.fee,
    jsonData: f1.jsonData
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
