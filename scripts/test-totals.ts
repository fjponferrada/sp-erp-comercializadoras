import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceType: true, subtotal1: true, invoiceData: true }
  });

  let jsTotalEur = 0;
  for (const inv of invoices) {
    const data = inv.invoiceData as any;
    let baseImponibleIva = 0;
    if (data) {
      let val = data['Base Imponible IVA'] || data['Base Imponible IVA CORR'];
      if (val) {
        baseImponibleIva = parseFloat(val.toString().replace(',', '.'));
      }
    }
    
    let amount = baseImponibleIva || inv.subtotal1 || 0;
    if (inv.invoiceType === 'Abono') {
      if (amount > 0) amount = -amount;
    }
    jsTotalEur += amount;
  }

  console.log('JS Total EUR:', jsTotalEur);

  const rawSum = await prisma.$queryRaw`
      SELECT 
        SUM(
          COALESCE(
            CAST(REPLACE(NULLIF("invoiceData"->>'Base Imponible IVA', ''), ',', '.') AS NUMERIC), 
            CAST(REPLACE(NULLIF("invoiceData"->>'Base Imponible IVA CORR', ''), ',', '.') AS NUMERIC), 
            subtotal1, 
            0
          ) * CASE WHEN "invoiceType" = 'Abono' THEN -1 ELSE 1 END
        ) as total_eur
      FROM "Invoice"
    `;

  console.log('SQL Total EUR:', rawSum);

  const rawSumNoAbs = await prisma.$queryRaw`
      SELECT 
        SUM(
          COALESCE(
            CAST(REPLACE(NULLIF("invoiceData"->>'Base Imponible IVA', ''), ',', '.') AS NUMERIC), 
            CAST(REPLACE(NULLIF("invoiceData"->>'Base Imponible IVA CORR', ''), ',', '.') AS NUMERIC), 
            subtotal1, 
            0
          )
        ) as total_eur
      FROM "Invoice"
    `;
    console.log('SQL Total EUR without Abono multiplier:', rawSumNoAbs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
