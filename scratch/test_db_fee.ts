import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031105546437024DF0F' } } }
  });
  const contract = await prisma.contract.findFirst({
    where: { supplyPointId: f1.supplyPointId }
  });

  // Temporarily set to 0 in DB
  await prisma.contract.update({ where: { id: contract.id }, data: { feeExcedentes: 0 } });
  let res0 = await InternalBillingEngine.calculate(f1.id);

  // Set back to 5 in DB
  await prisma.contract.update({ where: { id: contract.id }, data: { feeExcedentes: 5 } });
  let res5 = await InternalBillingEngine.calculate(f1.id);

  // Set to null in DB
  await prisma.contract.update({ where: { id: contract.id }, data: { feeExcedentes: null } });
  let resNull = await InternalBillingEngine.calculate(f1.id);

  // Restore to original
  await prisma.contract.update({ where: { id: contract.id }, data: { feeExcedentes: 5 } });

  console.log("With fee=0: total=", res0.excedentesAutoconsumo, " pexc=", res0.excedentesAutoconsumo/res0.excedentesKwh);
  console.log("With fee=5: total=", res5.excedentesAutoconsumo, " pexc=", res5.excedentesAutoconsumo/res5.excedentesKwh);
  console.log("With fee=null: total=", resNull.excedentesAutoconsumo, " pexc=", resNull.excedentesAutoconsumo/resNull.excedentesKwh);
}
main().finally(() => prisma.$disconnect());
