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
  
  console.log("Calculating...");
  try {
    const res = await InternalBillingEngine.calculate(f1, f1.contract);
    console.log("Surplus kWh:", res.excedentesKwh);
    console.log("Total Surplus Paid:", res.excedentesAutoconsumo);
    if (res.excedentesKwh && res.excedentesAutoconsumo) {
      console.log("Calculated pexc:", res.excedentesAutoconsumo / (res.excedentesKwh));
    }
  } catch (e) {
    console.error("Error calculating:", e);
  }
}

main().finally(() => prisma.$disconnect());
