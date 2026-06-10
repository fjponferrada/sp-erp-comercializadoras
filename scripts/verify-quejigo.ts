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
  const c = await prisma.contract.findFirst({ where: { contractCode: 'AEDJP2211301317J0F' }, include: { client: true } });
  console.log('El Quejigo Contract:', c?.contractCode, 'Client:', c?.client?.businessName, 'CIF:', c?.client?.vatNumber);
  
  const i = await prisma.invoice.findFirst({ where: { invoiceNumber: 'A260512637' }, include: { client: true } });
  console.log('El Quejigo Invoice A260512637 Client:', i?.client?.businessName, 'CIF:', i?.client?.vatNumber);
}

run().finally(() => process.exit(0));
