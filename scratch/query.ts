import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

// NO USAMOS EL ADAPTADOR AQUI
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({
    where: { vatNumber: '34001966P' },
    include: {
      supplyPoints: true
    }
  });
  console.log("CLIENT DATA:");
  console.log(JSON.stringify(client, null, 2));

  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260717844' }
  });
  console.log("\nINVOICE DATA:");
  console.log(JSON.stringify(invoice, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
