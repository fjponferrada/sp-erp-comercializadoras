import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const clients = await prisma.client.findMany({ 
    where: { 
      OR: [ 
        { businessName: { contains: 'ALJAVAL', mode: 'insensitive' } }, 
        { businessName: { contains: 'QUEJIGO', mode: 'insensitive' } },
        { lastName: { contains: 'ALJAVAL', mode: 'insensitive' } }
      ] 
    } 
  });
  console.log('Clients found:', JSON.stringify(clients, null, 2));

  // Also check if there's any raw invoice data with these names:
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: ['A260512164', 'A260512637'] } },
    include: { client: true, contract: true }
  });
  console.log('Invoices Data:', JSON.stringify(invoices.map(i => ({
    id: i.id, num: i.invoiceNumber, clientName: i.client?.businessName, clientFirst: i.client?.firstName, clientLast: i.client?.lastName,
    contractCode: i.contract?.contractCode
  })), null, 2));
}

run().finally(() => prisma.$disconnect());
