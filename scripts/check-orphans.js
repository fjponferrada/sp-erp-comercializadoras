const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const f1Invoices = await prisma.f1Invoice.count();
  const f1Unlinked = await prisma.f1Invoice.count({
    where: { supplyPointId: null }
  });

  const clientInvoices = await prisma.invoice.count();
  const clientUnlinked = await prisma.invoice.count({
    where: { OR: [{ contractId: null }, { clientId: null }] }
  });

  console.log(`F1 Invoices: ${f1Invoices} total, ${f1Unlinked} sin punto de suministro vinculado`);
  console.log(`Client Invoices: ${clientInvoices} total, ${clientUnlinked} sin contrato/cliente vinculado`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
