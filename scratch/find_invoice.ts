import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const invs = await prisma.invoice.findMany({
    where: {
      OR: [
        { invoiceNumber: { contains: 'A260614067' } },
        { invoiceData: { path: ['Numero'], string_contains: 'A260614067' } },
        { invoiceData: { path: ['Nombre/Razon Social'], string_contains: 'PARROQUIA' } },
        { invoiceData: { path: ['Nombre/Razon Social'], string_contains: 'ASUNCION' } }
      ]
    },
    include: {
      client: true
    }
  });
  
  console.log(`Found ${invs.length} invoices`);
  for (const inv of invs) {
    console.log(`Invoice: ${inv.invoiceNumber} | IssueDate: ${inv.issueDate} | Amount: ${inv.taxAmount} | Client: ${inv.client?.businessName}`);
  }
}
main();
