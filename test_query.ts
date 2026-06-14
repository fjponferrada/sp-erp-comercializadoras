import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const supplyPoints = await prisma.supplyPoint.findMany({
      where: { cups: { contains: 'ES0307000014568075GW' } }
    });
    console.log("SupplyPoints:", supplyPoints);

    const leads = await prisma.lead.findMany({
      where: { cups: { contains: 'ES0307000014568075GW' } }
    });
    console.log("Leads:", leads);
    
    const contracts = await prisma.contract.findMany({
      where: { nSolicitud: { contains: '202620696615' } }
    });
    console.log("Contracts:", contracts);

    console.log("SUCCESS");
  } catch(e) {
    console.error("ERROR:", e);
  }
}
main();
