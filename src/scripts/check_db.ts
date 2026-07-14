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
    select: { id: true, version: true, airtableId: true, p1c: true, p2c: true, p6c: true }
  });
  console.log(contracts);

  // Also let's check the airtable records for this contractCode
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const records = await base('CONTRATOS').select({
      filterByFormula: `{CONTRATO} = 'PRPR259181414SZ0F'`,
      fields: ['P1C', 'P2C', 'P3C', 'P4C', 'P5C', 'P6C', 'Version', 'CONTRATO']
    }).all();
    console.log("Airtable Records:", records.map(r => ({ id: r.id, fields: r.fields })));
  }
}

run().finally(() => prisma.$disconnect());
