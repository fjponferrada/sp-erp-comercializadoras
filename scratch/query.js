const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findFirst({
    where: { contractCode: 'PRPR2510301219NM0F' },
    include: {
      client: true,
      supplyPoint: true,
      product: true,
      Lead: true
    }
  });

  if (!c) {
    console.log("Contract not found!");
    return;
  }

  console.log("Client Type:", c.client.clientType);
  console.log("Product Tariff:", c.product?.tariff);
  console.log("SupplyPoint Tariff:", c.supplyPoint?.tariff);
  
  if (c.airtableData) {
    console.log("Contract airtableData keys:", Object.keys(c.airtableData));
    console.log("Contract airtableData TARIFA:", c.airtableData["tarifa"], c.airtableData["Tarifa"]);
  } else {
    console.log("Contract airtableData is null");
  }

  if (c.Lead?.contractData) {
    console.log("Lead contractData keys:", Object.keys(c.Lead.contractData));
    console.log("Lead contractData TARIFA:", c.Lead.contractData["tarifa"], c.Lead.contractData["Tarifa"]);
    // Let's find any key that includes "tarif" or "Tarif"
    const matchingKeys = Object.keys(c.Lead.contractData).filter(k => k.toLowerCase().includes('tarif'));
    console.log("Matching keys in Lead contractData:", matchingKeys);
    matchingKeys.forEach(k => {
      console.log(`Lead contractData["${k}"] =`, c.Lead.contractData[k]);
    });
  } else {
    console.log("Lead contractData is null");
  }

}

main().finally(() => prisma.$disconnect());
