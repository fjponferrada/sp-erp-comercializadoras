import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const lead = await prisma.lead.findFirst({ where: { cups: { not: null } } });
  if (!lead || !lead.cups) {
    console.log('No lead with CUPS found.');
    return;
  }
  
  console.log('Testing with CUPS:', lead.cups);
  const res = await fetch(`http://13.39.57.137:8004/Cups?cups=${lead.cups}&token=475b0437b1d35f423dba1863bbb7a100`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
