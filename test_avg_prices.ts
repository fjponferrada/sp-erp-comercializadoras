import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const inv = await prisma.internalInvoice.findFirst({
    where: {
      contract: {
        supplyPoint: { cups: { contains: 'ES0031104899528001TR' } }
      }
    },
    include: {
      contract: { include: { client: true, supplyPoint: true } }
    },
    orderBy: { issueDate: 'desc' }
  });

  if (!inv || !inv.f1InvoiceId) return;

  const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false, true);

  console.log("INTERNAL ERP BREAKDOWN:");
  console.log("P1 Energy Cost:", result.periods.P1?.energyCostEur, "MWh:", result.periods.P1?.f1ConsumptionMWh);
  console.log("P1 Price/MWh:", result.periods.P1?.energyCostEur / result.periods.P1?.f1ConsumptionMWh);

  console.log("P2 Energy Cost:", result.periods.P2?.energyCostEur, "MWh:", result.periods.P2?.f1ConsumptionMWh);
  console.log("P2 Price/MWh:", result.periods.P2?.energyCostEur / result.periods.P2?.f1ConsumptionMWh);

  console.log("P3 Energy Cost:", result.periods.P3?.energyCostEur, "MWh:", result.periods.P3?.f1ConsumptionMWh);
  console.log("P3 Price/MWh:", result.periods.P3?.energyCostEur / result.periods.P3?.f1ConsumptionMWh);
}

main().catch(console.error).finally(() => process.exit(0));
