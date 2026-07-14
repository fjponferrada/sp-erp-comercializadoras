import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const vipCount = await prisma.aggregatedLoadCurve.count({ where: { segment: 'VIP' } });
  console.log('VIP Count:', vipCount);
  const pymeCount = await prisma.aggregatedLoadCurve.count({ where: { segment: 'PYME >50 MWh' } });
  console.log('PYME >50 Count:', pymeCount);
  
  // also check if there are recent VIP records (last 30 days)
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const recentVip = await prisma.aggregatedLoadCurve.count({ where: { segment: 'VIP', date: { gte: d } } });
  console.log('Recent VIP Count:', recentVip);
}

main().finally(() => console.log('done'));
