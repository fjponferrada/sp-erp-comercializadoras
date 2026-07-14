import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function run() {
  const r1 = await prisma.$queryRaw`
    SELECT 
      to_char(COALESCE("billingEnd", "issueDate"), 'YYYY-MM') as month,
      SUM(COALESCE("totalMWh", 0) * CASE WHEN "invoiceType" = 'Abono' THEN -1 ELSE 1 END) as total_mwh
    FROM "Invoice"
    WHERE to_char(COALESCE("billingEnd", "issueDate"), 'YYYY-MM') IN ('2026-02', '2026-03', '2026-04')
    GROUP BY to_char(COALESCE("billingEnd", "issueDate"), 'YYYY-MM')
    ORDER BY month
  `;
  console.log('Grouped by billingEnd (Consumption):', r1);
  
  const r2 = await prisma.$queryRaw`
    SELECT 
      to_char("issueDate", 'YYYY-MM') as month,
      SUM(COALESCE("totalMWh", 0) * CASE WHEN "invoiceType" = 'Abono' THEN -1 ELSE 1 END) as total_mwh
    FROM "Invoice"
    WHERE to_char("issueDate", 'YYYY-MM') IN ('2026-02', '2026-03', '2026-04')
    GROUP BY to_char("issueDate", 'YYYY-MM')
    ORDER BY month
  `;
  console.log('Grouped by issueDate (Emission):', r2);
}

run().catch(console.error).finally(() => prisma.$disconnect());
