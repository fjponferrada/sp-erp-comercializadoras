import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: 'ES0031101305256003EB0F' }
  });
  console.log("SupplyPoints for CUPS:");
  console.dir(sps, { depth: null });
  
  const contracts = await prisma.contract.findMany({
    where: { supplyPointId: { in: sps.map(s => s.id) } },
    select: { id: true, clientId: true, supplyPointId: true }
  });
  console.log("Contracts:");
  console.dir(contracts, { depth: null });
}
main().finally(() => prisma.$disconnect());
