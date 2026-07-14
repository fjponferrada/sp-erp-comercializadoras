const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { cups: 'ES0031104045598001JV0F' }
  });
  if (lead) {
    console.log("Estimated MWh in DB:", lead.estimatedMWh);
    console.log("CONSUMO ANUAL KWH in Airtable:", lead.airtableData['CONSUMO ANUAL KWH']);
    console.log("Other Airtable fields related to consumo:", Object.keys(lead.airtableData).filter(k => k.toLowerCase().includes('consumo')).map(k => `${k}: ${lead.airtableData[k]}`));
    console.log("Bolsillo solar:", lead.airtableData['BOLSILLO SOLAR']);
    console.log("Envio de factura:", lead.airtableData['Envío de factura']);
  } else {
    console.log("Not found in leads");
  }
}
main().finally(() => prisma.$disconnect());
