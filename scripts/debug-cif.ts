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
  const c = await prisma.contract.findFirst({ where: { contractCode: 'AEDJP2211301317J0F' } });
  const data = c?.airtableData as any;
  if (!data) return;
  const keys = Object.keys(data).filter(k => k.toLowerCase().includes('cif') || k.toLowerCase().includes('nif') || k.toLowerCase().includes('ident'));
  const vals: any = {};
  keys.forEach(k => vals[k] = data[k]);
  
  // also check exact 'CIF' field which might not have 'cif' in the name if I spelled it wrong
  vals['CIF'] = data['CIF'];
  vals['NIF'] = data['NIF'];
  
  console.log('CIF related fields for Quejigo:', vals);
}

run().finally(() => process.exit(0));
