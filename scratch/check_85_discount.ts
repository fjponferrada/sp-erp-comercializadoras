import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const invs = await prisma.invoice.findMany({
    where: {
      supplyPoint: {
        cups: 'ES0031102722873001YA0F'
      },
      issueDate: {
        gte: new Date('2026-04-01T00:00:00.000Z'),
        lte: new Date('2026-06-30T23:59:59.999Z')
      }
    },
    include: { supplyPoint: true }
  });
  console.log(`Found ${invs.length} invoices in Q2 for this CUPS.`);
  if (invs.length > 0) {
     console.log('ieDiscount:', invs[0].supplyPoint?.ieDiscount);
     console.log('taxAmount:', invs[0].invoiceData?.['Importe Impuesto']);
     console.log('zona (provincia):', invs[0].supplyPoint?.province);
  }
}
main();
