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
  const vipCount = await prisma.supplyPoint.count({ where: { segment: 'VIP' } });
  console.log('SupplyPoint VIP Count:', vipCount);
  
  const pymeCount = await prisma.supplyPoint.count({ where: { segment: 'PYME >50 MWh' } });
  console.log('SupplyPoint PYME >50 Count:', pymeCount);

  // let's look at one of the VIP CUPS the user mentioned: ES0031104456078001MY0F
  const cups1 = await prisma.supplyPoint.findFirst({ where: { cups: { contains: 'ES0031104456078001MY' } } });
  console.log('CUPS 1:', cups1?.cups, 'Segment:', cups1?.segment, 'Consumption:', cups1?.annualConsumption);
}

main().finally(() => console.log('done'));
