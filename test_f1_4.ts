import { prisma } from './src/lib/prisma';
import fs from 'fs';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { id: "cmqlk8zzi000f4s41xhqwl0mj" },
    include: { contract: true }
  });
  
  if (!f1) return;
  fs.writeFileSync('f1_4_data.json', JSON.stringify({
    totalAmount: f1.totalAmount,
    baseImponible: f1.baseImponible,
    totalPeajes: f1.totalPeajes,
    totalCargos: f1.totalCargos,
    fee: f1.fee,
    contract_p1e: f1.contract?.p1e,
    contract_p1p: f1.contract?.p1p,
    jsonData: f1.jsonData
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
