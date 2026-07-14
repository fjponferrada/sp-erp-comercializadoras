import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      issueDate: {
        gte: new Date('2026-04-01'),
        lte: new Date('2026-06-30')
      }
    },
    take: 10
  });

  for (const inv of invoices) {
    const data = inv.invoiceData as any;
    console.log(`Invoice ${inv.invoiceNumber} - Fecha: ${inv.issueDate}`);
    console.log(`  Importe Impuesto: ${data['Importe Impuesto']}`);
    console.log(`  % Impuesto: ${data['% Impuesto Electrico'] || data['% Impuesto Eléctrico'] || 'NOT FOUND'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
