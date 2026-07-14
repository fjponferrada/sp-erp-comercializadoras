import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const brandId = 'cmq6j25l50001d441e0c06g9t'; // AED
  const start = new Date(Date.UTC(2025, 0, 1));
  const end = new Date(Date.UTC(2025, 2, 31, 23, 59, 59, 999));
  
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { brandId },
      issueDate: { gte: start, lte: end },
    },
    include: { supplyPoint: true }
  });

  let totalBase = 0;
  let espBase = 0;
  let taxSum = 0;
  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  const seen = new Set<string>();

  for (const inv of invoices) {
    if (inv.invoiceNumber) {
      if (seen.has(inv.invoiceNumber)) continue;
      seen.add(inv.invoiceNumber);
    }
    const data = inv.invoiceData as any;
    let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
    let tax = data ? parseNum(data['Importe Impuesto']) : 0;
    
    if (inv.invoiceType?.toLowerCase().includes('abono')) {
       if (subtotal > 0) subtotal = -subtotal;
       if (tax > 0) tax = -tax;
    }

    totalBase += subtotal;
    taxSum += tax;

    const prov = (inv.supplyPoint?.province || '').toLowerCase();
    let zona = 'España';
    if (prov.includes('navarra')) zona = 'Navarra';
    else if (prov.includes('alava') || prov.includes('álava')) zona = 'Álava';
    else if (prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) zona = 'Guipúzcoa';
    else if (prov.includes('vizcaya') || prov.includes('bizkaia')) zona = 'Vizcaya';

    if (zona === 'España') {
       espBase += subtotal;
    }
  }

  console.log('Total Base (All Zones):', totalBase);
  console.log('Total Base (España):', espBase);
  console.log('Total Tax (All Zones):', taxSum);
}

main().catch(console.error).finally(() => prisma.$disconnect());
