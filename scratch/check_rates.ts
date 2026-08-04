import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function check() {
  const brandId = 'cmq6j25l50001d441e0c06g9t';
  const year = 2026;
  
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));

  const invoices = await prisma.invoice.findMany({
    where: { client: { brandId }, issueDate: { gte: startDate, lte: endDate } },
    include: { supplyPoint: true },
  });

  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  
  for (const inv of invoices) {
    const data = inv.invoiceData as any;
    let taxPct = data?.['Impuesto (%)'] ? parseNum(data['Impuesto (%)']) : (inv.taxPercentage || 5.11);
    taxPct = Math.round(taxPct * 100) / 100;
    
    if (taxPct === 0.77 || taxPct === 0.5) {
      console.log(`Invoice ${inv.invoiceNumber} | Tarifa: ${inv.supplyPoint?.tariff} | Regimen: ${inv.supplyPoint?.regimenFiscal} | Date: ${inv.issueDate.toISOString()} | Pct: ${taxPct} | Subtotal: ${data['Subtotal 1']} | Impuesto: ${data['Importe Impuesto']}`);
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
