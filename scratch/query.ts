import { PrismaClient } from '@prisma/client';
process.env.DATABASE_URL = "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true";
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
    console.log("Contract airtableData TARIFA:", (c.airtableData as any)["tarifa"], (c.airtableData as any)["Tarifa"]);
  } else {
    console.log("Contract airtableData is null");
  }

  if (c.Lead?.contractData) {
    const cd = c.Lead.contractData as Record<string, any>;
    console.log("Lead contractData keys:", Object.keys(cd));
    console.log("Lead contractData TARIFA:", cd["tarifa"], cd["Tarifa"]);
    // Let's find any key that includes "tarif" or "Tarif"
    const matchingKeys = Object.keys(cd).filter(k => k.toLowerCase().includes('tarif'));
    console.log("Matching keys in Lead contractData:", matchingKeys);
    matchingKeys.forEach(k => {
      console.log(`Lead contractData["${k}"] =`, cd[k]);
    });
  } else {
    console.log("Lead contractData is null");
  }

}

main().finally(() => prisma.$disconnect());
