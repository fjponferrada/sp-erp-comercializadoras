import { prisma } from './src/lib/prisma';

async function main() {
  const clients = await prisma.client.findMany();
  const client = clients.find(c => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''} ${c.lastName2 || ''}`.toUpperCase();
    return fullName.includes('KISKO') || (c.businessName && c.businessName.toUpperCase().includes('KISKO'));
  });

  if (!client) {
    console.log("Client not found");
    return;
  }

  const contracts = await prisma.contract.findMany({
    where: { clientId: client.id },
    include: {
      internalInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  console.log("CLIENT:", client.firstName, client.lastName, client.businessName);
  for (const contract of contracts) {
    console.log("TARIFF:", contract.tariff);
    console.log("CONTRACT P1E:", contract.p1e);
    console.log("CONTRACT P2E:", contract.p2e);
    console.log("CONTRACT P3E:", contract.p3e);
    console.log("CONTRACT P4E:", contract.p4e);
    console.log("CONTRACT P5E:", contract.p5e);
    console.log("CONTRACT P6E:", contract.p6e);
    console.log("CONTRACT P1P:", contract.p1p);
    console.log("CONTRACT P2P:", contract.p2p);
    console.log("CONTRACT P3P:", contract.p3p);
    console.log("CONTRACT P4P:", contract.p4p);
    console.log("CONTRACT P5P:", contract.p5p);
    console.log("CONTRACT P6P:", contract.p6p);
    console.log("Indexed?", contract.indexed);
    console.log("Fee?", contract.fee);
    console.log("--- INVOICE DRAFT ---");
    for (const inv of contract.internalInvoices) {
      console.log("Invoice ID:", inv.id);
      const data = inv.invoiceData as any;
      console.log("totalAmount:", data?.totalAmount);
      console.log("totalBase:", data?.totalBase);
      console.log("taxAmount:", data?.taxAmount);
      console.log("taxElectric:", data?.taxElectric);
      console.log("powerCost:", data?.powerCost);
      console.log("energyCost:", data?.energyCost);
      console.log("peajesDistribuidora:", data?.peajesDistribuidora);
      console.log("cargosDistribuidora:", data?.cargosDistribuidora);
      console.log("feeCost:", data?.feeCost);
      console.log("alquilerEquipo:", data?.alquilerEquipo);
      console.log("bonoSocial:", data?.bonoSocial);
      console.log("FNEE:", data?.fneeCost);
      console.log("Excesos Potencia:", data?.excesosPotencia);
      console.log("repairData:", data?.repairData);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
