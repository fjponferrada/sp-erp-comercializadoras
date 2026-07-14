import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.invoice.findFirst({ where: { invoiceNumber: 'A260614452' } });
  console.log('A260614452 totalMWh:', inv?.totalMWh);
}
main();
