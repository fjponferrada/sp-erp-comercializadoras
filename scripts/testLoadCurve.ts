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
  const c = await prisma.loadCurve.findFirst({where: {cups: {contains: 'ES0031104456078001MY'}}});
  console.log('LoadCurve CUPS:', c?.cups);
  
  const h = await prisma.loadCurve.findFirst({where: {cups: {contains: 'ES0031104456078001MY0F'}}});
  console.log('LoadCurve CUPS with 0F:', h?.cups);
}

main().finally(() => console.log('done'));
