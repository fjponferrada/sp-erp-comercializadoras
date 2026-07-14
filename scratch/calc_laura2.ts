import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031105546437024DF0F' } } },
    include: { supplyPoint: true, contract: { include: { product: true } } }
  });
  
  if (!f1) {
    console.log("No F1 found");
    return;
  }
  
  console.log("Contract feeExcedentes:", f1.contract.feeExcedentes);
  
  const originalFee = f1.contract.feeExcedentes;

  // Test with fee = 5
  f1.contract.feeExcedentes = 5;
  let res = await InternalBillingEngine.calculate(f1.id, f1.contract);
  let pexc = res.excedentesAutoconsumo / (res.excedentesKwh);
  console.log("With fee=5, surplus MWh:", res.excedentesKwh/1000, " Total:", res.excedentesAutoconsumo, " pexc:", pexc);

  // Test with fee = 0
  f1.contract.feeExcedentes = 0;
  res = await InternalBillingEngine.calculate(f1.id, f1.contract);
  pexc = res.excedentesAutoconsumo / (res.excedentesKwh);
  console.log("With fee=0, surplus MWh:", res.excedentesKwh/1000, " Total:", res.excedentesAutoconsumo, " pexc:", pexc);

}

main().finally(() => prisma.$disconnect());
