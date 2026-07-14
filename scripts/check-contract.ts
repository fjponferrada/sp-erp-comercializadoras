import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: 'postgresql://postgres:SpEnergia2026%21@localhost:5432/sperp_local' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const c = await prisma.contract.findFirst({where: { contractCode: 'PRPR259181414SZ0F' }});
  console.log(JSON.stringify(c?.airtableData, null, 2));
}

main().finally(() => prisma.$disconnect());
