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
  const orphans = await prisma.contract.findMany({ 
    where: { brandId: null }, 
    select: { 
      id: true, 
      contractCode: true, 
      version: true,
      airtableId: true,
      _count: { select: { invoices: true } } 
    } 
  }); 
  console.log(JSON.stringify(orphans, null, 2)); 

  // Look up their counterparts that HAVE brandId
  for (const o of orphans) {
    const counterpart = await prisma.contract.findFirst({
      where: {
        contractCode: o.contractCode,
        version: o.version,
        brandId: { not: null }
      },
      select: {
        id: true,
        airtableId: true,
        _count: { select: { invoices: true } }
      }
    });
    console.log(`\nCounterpart for ${o.contractCode}:`, counterpart);
  }
}

run().finally(() => prisma.$disconnect());
