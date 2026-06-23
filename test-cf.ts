import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const f1s = await prisma.f1Invoice.findMany({
    take: 5,
    where: { numeroFactura: { startsWith: 'CF ' } }
  });
  console.log('F1s starting with CF:', f1s.map(f => f.numeroFactura));

  const invs = await prisma.$queryRaw`
    SELECT "invoiceData" FROM "Invoice"
    WHERE "invoiceData"::text LIKE '%CF %'
    LIMIT 5;
  `;
  console.log('Invoices with CF:', JSON.stringify(invs, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
