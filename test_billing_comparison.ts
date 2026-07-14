async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const { InternalBillingEngine } = await import('./src/lib/services/InternalBillingEngine');
  
  const f1s = await prisma.f1Invoice.findMany({
    where: { id: "cmqlldzcv00047841wcchb24j" },
    include: {
      invoices: true,
      contract: true
    }
  });

  if (f1s.length === 0) {
    console.log("No F1 found with linked invoice.");
    return;
  }

  for (const f1 of f1s) {
    console.log("-----------------------------------------");
    console.log("F1 ID:", f1.id);
    const airData = typeof (f1.contract as any).airtableData === 'string' ? JSON.parse((f1.contract as any).airtableData) : (f1.contract as any).airtableData;
    console.log("Contract:", f1.contract?.id, "Pricing Model:", f1.contract?.pricingModel, "Airtable FIJO/INDEX:", airData?.['FIJO / INDEX'], "P1E db:", f1.contract?.p1e);
    console.log("F1 Period:", f1.fechaInicio, "to", f1.fechaFin);
    console.log("--- Issued Invoice(s) ---");
    for (const inv of f1.invoices) {
      console.log("Invoice ID:", inv.id, "Number:", inv.invoiceNumber);
      console.log("Total Amount:", inv.totalAmount);
      console.log("Base Imponible:", inv.subtotal1);
    }

    console.log("--- Calculating InternalBillingEngine ---");
    try {
      const result = await InternalBillingEngine.calculate(f1.id);
      console.log("Result Base Imponible:", result.totalBase);
      console.log("Result Total + Taxes:", result.totalAmount);
      console.log("Result Total CCH MWh:", result.totalCchMWh);
      console.log("Result Total F1 MWh:", result.totalF1MWh);
      console.log("Result Energy Cost:", result.energyCost);
      console.log("Result Power Cost:", result.powerCost);
      console.log("Result Peajes/Cargos:", (result as any).peajesDistribuidora, (result as any).cargosDistribuidora);
      console.log("Result Tax Electric:", (result as any).taxElectric);
    } catch (err) {
      console.error("Calculation Error:", err.message);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
