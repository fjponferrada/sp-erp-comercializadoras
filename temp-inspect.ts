import { prisma } from './src/lib/prisma';

async function main() {
  const drafts = await prisma.internalInvoice.findMany({
    where: {
      contract: {
        supplyPoint: { cups: { endsWith: '1VX0F' } }
      }
    },
    include: {
      contract: { include: { client: true, supplyPoint: true } },
      f1Invoice: true
    }
  });

  const targetDraft = drafts.find((d: any) => 
    d.f1Invoice && 
    new Date(d.f1Invoice.fechaInicio).getMonth() === 0 && // January
    new Date(d.f1Invoice.fechaInicio).getFullYear() === 2026 &&
    (d as any)._tipo !== 'AR'
  );

  if (!targetDraft) {
    console.log("Draft not found");
    return;
  }

  console.log("Found draft:", targetDraft.id);
  console.log("Status:", targetDraft.status);
  console.log("Total Amount:", targetDraft.totalAmount);
  console.log("Repair Data:", JSON.stringify(targetDraft.repairData, null, 2));
  
  const invoiceData = targetDraft.invoiceData as any;
  if (invoiceData) {
    console.log("Power Margin:", invoiceData.powerMargin);
    console.log("Energy Margin:", invoiceData.energyMargin);
    console.log("Repaired:", invoiceData.repaired);
    console.log("Energy Cost Eur:", invoiceData.energyCost);
    console.log("MWh billed (F1):", invoiceData.totalF1MWh);
    console.log("MWh calculated (CCH):", invoiceData.totalCchMWh);
    console.log("Excesos potencia:", invoiceData.excesosPotencia);
    console.log("Penalizacion reactiva:", invoiceData.reactiveEnergyCost);
    console.log("FNEE:", invoiceData.fneeCost);
    console.log("Peajes:", invoiceData.peajesDistribuidora);
    console.log("Cargos:", invoiceData.cargosDistribuidora);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
