import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) {
    console.log("No comp found");
    return;
  }
  
  console.log("Company ID:", comp.id);

  const inv1 = await prisma.invoice.count({
    where: { companyId: comp.id }
  });

  const inv2 = await prisma.invoice.count({
    where: { client: { brand: { companyId: comp.id } } }
  });
  
  const inv3 = await prisma.invoice.count();

  console.log("Invoices with companyId:", inv1);
  console.log("Invoices with client->brand->companyId:", inv2);
  console.log("Total Invoices:", inv3);

  const sample = await prisma.invoice.findFirst({
    where: { billingStart: { not: null } },
    include: { client: { include: { brand: true } } }
  });
  
  if (sample) {
    console.log("Sample invoice companyId:", sample.companyId);
    console.log("Sample invoice client brand companyId:", sample.client?.brand?.companyId);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
