import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL || 'postgresql://postgres:SpEnergia2026%21@localhost:5432/sperp_local';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const contracts = await prisma.contract.findMany({
    where: { contractCode: 'PRPR259181414SZ0F' },
    include: { supplyPoint: true, Lead: true }
  });
  
  for (const c of contracts) {
    console.log(`\nVersion: ${c.version} | ID: ${c.id}`);
    console.log(`Contract P1C: ${c.p1c}, P6C: ${c.p6c}`);
    console.log(`SupplyPoint P1C: ${c.supplyPoint?.p1c}, P6C: ${c.supplyPoint?.p6c}`);
    console.log(`Lead P1C: ${c.Lead?.p1c}, P6C: ${c.Lead?.p6c}`);
    console.log(`SupplyPoint P1P: ${c.supplyPoint?.p1p}`);
    console.log(`Resulting logic (c.p1c || sp.p1c || lead.p1c || sp.p1p): ${c.p1c || c.supplyPoint?.p1c || c.Lead?.p1c || c.supplyPoint?.p1p || '-'}`);
  }
}

run().finally(() => prisma.$disconnect());
