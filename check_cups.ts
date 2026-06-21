import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cupsQuery = 'ES0031406168126004FL0F';
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: cupsQuery },
    include: {
      client: true,
      contracts: true,
      invoices: true
    }
  });

  console.log(`Encontrados ${sps.length} SupplyPoints para ${cupsQuery}`);
  sps.forEach(sp => {
    console.log(`\nSP ID: ${sp.id} | Client: ${sp.client.businessName || sp.client.firstName} (${sp.clientId})`);
    console.log(`Contratos:`);
    sp.contracts.forEach(c => console.log(`  - ${c.contractCode} | Status: ${c.status}`));
    console.log(`Invoices: ${sp.invoices.length}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
