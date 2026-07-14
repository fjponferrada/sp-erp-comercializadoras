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
  const i = await prisma.invoice.findMany({
    where: {
      invoiceData: {
        path: ['NOMBRE/RAZON SOCIAL'],
        string_contains: 'ALJAVAL'
      }
    },
    take: 2
  });
  console.log('Result:', i.map(inv => inv.invoiceNumber));
}

run().finally(() => prisma.$disconnect());
