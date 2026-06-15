const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const leadId = 'cmqe3j1sb000004kvjdbab4gi'; // From user's screenshot
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: { include: { client: true } }, user: { include: { brand: true } } },
    });
    console.log("Lead exists:", !!lead);
    console.log("Contract exists:", !!lead.contract);
    if (!lead || !lead.contract) return;
    
    console.log("Client in contract exists:", !!lead.contract.client);
    console.log("clientId:", lead.contract.clientId);
    console.log("supplyPointId:", lead.contract.supplyPointId);

    if (lead.contract.clientId) {
      console.log("Updating Client:", lead.contract.clientId);
      await prisma.client.update({
        where: { id: lead.contract.clientId },
        data: { businessName: lead.businessName }
      });
    }

    if (lead.contract.supplyPointId) {
      console.log("Updating SupplyPoint:", lead.contract.supplyPointId);
      await prisma.supplyPoint.update({
        where: { id: lead.contract.supplyPointId },
        data: { cups: lead.cups || "test" }
      });
    } else {
        console.error("ERROR: lead.contract.supplyPointId is null");
    }

    console.log("Success");
  } catch(e) {
    console.error("FAILED:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
