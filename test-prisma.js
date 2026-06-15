require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { contract: { include: { supplyPoint: true } } }
  });
  
  for (const lead of leads) {
    console.log(`\n=== LEAD ${lead.id} ===`);
    console.log("contractData.direccion:", JSON.stringify(lead.contractData?.direccion));
    console.log("contractData.direccionSuministro:", JSON.stringify(lead.contractData?.direccionSuministro));
    console.log("contractData:", JSON.stringify(lead.contractData, null, 2));
    console.log("SupplyPoint:", JSON.stringify(lead.contract?.supplyPoint, null, 2));
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
