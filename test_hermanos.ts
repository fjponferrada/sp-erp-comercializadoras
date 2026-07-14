import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const clients = await prisma.client.findMany();
  const matchedClients = clients.filter(c => {
    const name = c.businessName || '';
    return name.toUpperCase().includes('JURADO');
  });

  for (const client of matchedClients) {
    console.log("Checking client:", client.businessName);

    const contracts = await prisma.contract.findMany({
      where: { clientId: client.id },
      include: {
        supplyPoint: true,
        internalInvoices: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    for (const contract of contracts) {
      const inv = contract.internalInvoices.find(i => i.totalMWh === 11.979 || (i.totalMWh && i.totalMWh >= 11.9 && i.totalMWh <= 12));
      if (!inv) continue;

      console.log("Found invoice:", inv.id);
      const data = inv.invoiceData as any;
      console.log("Pricing Model:", contract.pricingModel);
      console.log("Tariff:", contract.supplyPoint.tariff);
      console.log("ERP Total:", data.totalAmount);
      console.log("Energy Cost:", data.energyCost);
      console.log("Power Cost:", data.powerCost);
      console.log("Peajes:", data.peajesDistribuidora);
      console.log("Cargos:", data.cargosDistribuidora);
      console.log("FNEE:", data.fneeCost);
      console.log("Bono Social:", data.bonoSocial);
      console.log("Alquiler:", data.alquilerEquipo);
      console.log("Excesos Potencia:", data.excesosPotencia);
      console.log("Excedentes:", data.excedentesAutoconsumo);
      console.log("Reactiva Cost:", data.reactiveEnergyCost);
      console.log("Tax Electric:", data.taxElectric);

      // Recalculate just in case
      if (inv.f1InvoiceId) {
        console.log("Recalculating...");
        const result = await InternalBillingEngine.calculate(inv.f1InvoiceId, false);
        console.log("NEW ERP Total:", result.totalAmount);
        console.log("NEW powerCost:", result.powerCost);
        console.log("NEW energyCost:", result.energyCost);
        console.log("NEW Reactiva Cost:", result.reactiveEnergyCost);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
