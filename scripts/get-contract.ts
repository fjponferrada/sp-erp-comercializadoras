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
  const c = await prisma.contract.findUnique({ where: { id: 'cmqfit3hr001aas41su0eqgxa' }, include: { client: true, supplyPoint: true }});
  console.log('Contract Code:', c?.contractCode);
  console.log('Client:', c?.client?.businessName);
  console.log('CUPS:', c?.supplyPoint?.cups);
  console.log('ID:', c?.id);
}
run();
