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
  await prisma.invoice.deleteMany({ where: { contractId: 'cmqfit3hr001aas41su0eqgxa' } });
  await prisma.switchingEvent.deleteMany({ where: { contractId: 'cmqfit3hr001aas41su0eqgxa' } });
  await prisma.contract.delete({ where: { id: 'cmqfit3hr001aas41su0eqgxa' } });
  console.log('Dummy contract deleted');
}
run();
