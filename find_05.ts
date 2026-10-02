import { prisma } from './src/lib/prisma';

async function main() {
  const startDate = new Date(Date.UTC(2026, 6, 1));
  const endDate = new Date(Date.UTC(2026, 8, 30, 23, 59, 59, 999));

  const invoices = await prisma.invoice.findMany({
    where: {
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      supplyPoint: true,
    }
  });

  for (const inv of invoices) {
    const data = inv.invoiceData as any;
    if (!data) continue;
    
    let taxPct = data['Impuesto (%)'] ? parseFloat(data['Impuesto (%)'].toString().replace(',', '.')) : (inv.taxPercentage || 5.11);
    taxPct = Math.round(taxPct * 100) / 100;
    
    if (taxPct === 0.5) {
      console.log('--- Factura al 0.5% ---');
      console.log('Número:', inv.invoiceNumber);
      console.log('Fecha Emisión:', inv.issueDate);
      console.log('Periodo:', data['Periodo Facturación'] || data['Fecha Inicio'] + ' a ' + data['Fecha Fin'] || 'Desconocido');
      console.log('Tipo:', inv.invoiceType);
      console.log('Base:', data['Subtotal 1']);
      console.log('Impuesto:', data['Importe Impuesto']);
      console.log('CUPS:', inv.supplyPoint?.cups);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
