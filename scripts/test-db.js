const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT count(*) FROM "Invoice"`;
  console.log('Invoice count:', result);

  const sampleInvoice = await prisma.invoice.findFirst({ select: { id: true, issueDate: true, invoiceData: true, subtotal1: true } });
  console.log('Sample Invoice:', sampleInvoice ? { id: sampleInvoice.id, issueDate: sampleInvoice.issueDate } : 'None');

  if (sampleInvoice) {
    const rawSum = await prisma.$queryRaw`
      SELECT 
        to_char("issueDate", 'YYYY-MM') as month,
        SUM(
          COALESCE(
            CAST(NULLIF("invoiceData"->>'Base Imponible IVA', '') AS NUMERIC), 
            CAST(NULLIF("invoiceData"->>'Base Imponible IVA CORR', '') AS NUMERIC), 
            subtotal1, 
            0
          ) * CASE WHEN "invoiceType" = 'Abono' THEN -1 ELSE 1 END
        ) as total_eur
      FROM "Invoice"
      WHERE id = ${sampleInvoice.id}
      GROUP BY to_char("issueDate", 'YYYY-MM')
    `;
    console.log('Raw sum result:', rawSum);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
