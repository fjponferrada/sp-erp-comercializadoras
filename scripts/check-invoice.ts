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
  const inv1 = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260512164' },
    include: { client: true, contract: { include: { client: true } }, supplyPoint: { include: { client: true } } }
  });
  console.log('Invoice A260512164:', JSON.stringify(inv1, null, 2));

  const inv2 = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260512637' },
    include: { client: true, contract: { include: { client: true } }, supplyPoint: { include: { client: true } } }
  });
  console.log('Invoice A260512637:', JSON.stringify(inv2, null, 2));
}

run().finally(() => prisma.$disconnect());
