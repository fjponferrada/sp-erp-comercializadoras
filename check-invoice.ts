import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260615648' }
  });
  console.log("PDF:", inv?.pdfUrl);
  console.log("XML:", (inv?.invoiceData as any)?.xmlUrl);
  console.log("Tiene XML:", !!(inv?.invoiceData as any)?.xmlUrl);
}

main().catch(console.error).finally(() => process.exit(0));
