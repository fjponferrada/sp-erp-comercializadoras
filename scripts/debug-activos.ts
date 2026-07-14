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
  const activos = await prisma.contract.findMany({ where: { status: 'ACTIVO' }, include: { supplyPoint: true } });
  
  let noActivationDate = 0;
  let hasTerminationDate = 0;
  
  const cupsCount = {};
  
  for (const c of activos) {
    if (!c.activationDate) {
      console.log('No activation date:', c.id);
      noActivationDate++;
    }
    if (c.terminationDate) {
      console.log('Has termination date but is ACTIVO:', c.id);
      hasTerminationDate++;
    }
    if (c.supplyPoint?.cups) {
      cupsCount[c.supplyPoint.cups] = (cupsCount[c.supplyPoint.cups] || 0) + 1;
    }
  }
  
  let duplicateCups = 0;
  for (const [cups, count] of Object.entries(cupsCount)) {
    if ((count as number) > 1) {
      console.log('Duplicate ACTIVO for CUPS:', cups, 'Count:', count);
      duplicateCups++;
    }
  }
  
  console.log({ noActivationDate, hasTerminationDate, duplicateCups });
}
run();
