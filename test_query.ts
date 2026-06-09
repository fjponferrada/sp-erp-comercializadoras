import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const leadsDB = await prisma.lead.findMany({
      where: {}, // test empty filter first
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        documents: true,
        user: true,
        contract: true
      }
    });

    const cupsList = leadsDB.map(l => l.cups).filter(Boolean) as string[];
    const supplyPoints = await prisma.supplyPoint.findMany({
      where: { cups: { in: cupsList } },
      select: { cups: true, address: true }
    });

    console.log("SUCCESS:", leadsDB.length, supplyPoints.length);
  } catch(e) {
    console.error("ERROR:", e);
  }
}
main();
