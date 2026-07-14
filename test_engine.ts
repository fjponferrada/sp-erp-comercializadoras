import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const inv = await prisma.f1Invoice.findFirst({
    where: {
      supplyPoint: { cups: { contains: 'ES0021000013147731TP' } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!inv) return;
  console.log("Testing invoice", inv.id);
  const res = await InternalBillingEngine.calculate(inv.id, true, true);
  console.log("hasMismatch:", res.hasMismatch);
  console.log("mismatchReason:", res.mismatchReason);
  console.log("excedentesAutoconsumo:", res.excedentesAutoconsumo);
  console.log("pexc:", res.pexc);
}

main().catch(console.error).finally(() => process.exit(0));
