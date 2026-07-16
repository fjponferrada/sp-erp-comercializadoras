import { prisma } from '../src/lib/prisma';

async function main() {
  const brandId = 'cmq6j25l50001d441e0c06g9t'; // AED
  const year = 2025;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));
  
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { brandId },
      issueDate: { gte: start, lte: end },
    },
    include: { supplyPoint: true }
  });

  let totalEnergy = 0;
  let totalSubtotal = 0;
  let totalTax = 0;

  for (const inv of invoices) {
    const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
    const data = inv.invoiceData as any;
    if (!data) continue;

    let energy = parseFloat(data['Energía Total Consumida']?.toString().replace(',','.')) || 0;
    let subtotal = parseFloat(data['Subtotal 1']?.toString().replace(',','.')) || 0;
    let tax = parseFloat(data['Importe Impuesto']?.toString().replace(',','.')) || 0;

    if (isAbono) {
      energy = -energy;
      subtotal = -subtotal;
      tax = -tax;
    }

    totalEnergy += energy;
    totalSubtotal += subtotal;
    totalTax += tax;
  }

  console.log(`Total Energy (kWh): ${totalEnergy.toFixed(2)}`);
  console.log(`Total Subtotal 1 (€): ${totalSubtotal.toFixed(2)}`);
  console.log(`Total Impuesto (€): ${totalTax.toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
