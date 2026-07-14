import * as fs from 'fs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2025_T2.txt';
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  let totalCuotaIntegra = 0;
  let totalCuotaMinima = 0;
  let totalBaseTxt = 0;

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length >= 12) {
      const base = parseFloat(parts[2]) || 0;
      const cuotaIntegra = parseFloat(parts[10]) || 0;
      const cuotaMinima = parseFloat(parts[11]) || 0;
      totalBaseTxt += base;
      totalCuotaIntegra += cuotaIntegra;
      totalCuotaMinima += cuotaMinima;
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  
  console.log(`--- T2 2025 TXT (Solo España) ---`);
  console.log(`Base Imponible TXT: ${round2(totalBaseTxt).toFixed(2)}`);
  console.log(`Cuota Íntegra TXT: ${round2(totalCuotaIntegra).toFixed(2)}`);
  console.log(`Cuota Mínima TXT: ${round2(totalCuotaMinima).toFixed(2)}`);
  console.log(`TOTAL LIQUIDACIÓN TXT: ${round2(totalCuotaIntegra + totalCuotaMinima).toFixed(2)}`);

  // Now calculate total for ALL zones to see if it matches the user's declared 33313.16
  const brandId = 'cmq6j25l50001d441e0c06g9t';
  const start = new Date(Date.UTC(2025, 3, 1));
  const end = new Date(Date.UTC(2025, 5, 30, 23, 59, 59, 999));
  
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { brandId },
      issueDate: { gte: start, lte: end },
    },
    include: { supplyPoint: true }
  });

  let totalBaseAll = 0;
  let taxSumAll = 0;
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

    totalBaseAll += subtotal;
    taxSumAll += tax;
  }

  console.log(`\n--- T2 2025 ALL ZONES (Lo que se declaró por error) ---`);
  console.log(`Base Imponible All: ${round2(totalBaseAll).toFixed(2)}`);
  console.log(`Cuota Íntegra All: ${round2(taxSumAll).toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
