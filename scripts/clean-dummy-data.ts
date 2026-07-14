import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Limpiando datos inventados...");

  await prisma.document.deleteMany({});
  await prisma.contractModification.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.solarQuote.deleteMany({});
  await prisma.supplyPoint.deleteMany({});
  await prisma.client.deleteMany({});
  // await prisma.product.deleteMany({});
  // await prisma.channel.deleteMany({});
  // await prisma.user.deleteMany({ where: { email: { notIn: ['admin@aed.com', 'comercial@aed.com', 'backoffice@aed.com', 'canal1@aed.com'] } } });

  console.log("Datos inventados borrados.");
}

run().catch(console.error).finally(() => process.exit(0));
