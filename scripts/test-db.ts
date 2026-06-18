import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('Testing DB connection...');
  const result = await prisma.$queryRaw`SELECT count(*) FROM "Invoice"`;
  console.log('Invoice count:', result);

  const sampleInvoices = await prisma.invoice.findMany({ take: 2, select: { id: true } });
  if (sampleInvoices.length > 0) {
    const chunk = sampleInvoices.map(i => i.id);
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
      WHERE id IN (${Prisma.join(chunk)}) AND "issueDate" IS NOT NULL
      GROUP BY to_char("issueDate", 'YYYY-MM')
    `;
    console.log('Raw sum result:', rawSum);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
