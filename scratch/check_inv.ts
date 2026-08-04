import { prisma } from '../src/lib/prisma';
import 'dotenv/config';

async function check() {
  const inv = await prisma.invoice.findUnique({
    where: { invoiceNumber: 'A260305781' }
  });
  console.log(inv);
}

check().catch(console.error).finally(() => prisma.$disconnect());
