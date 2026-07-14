import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { contractCode: 'AEDJPL26221622TF0F' },
    include: {
      Lead: true,
      client: true,
      supplyPoint: true,
      product: true
    }
  });
  console.log(JSON.stringify(contract, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
