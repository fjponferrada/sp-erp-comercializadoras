import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching active/tramitando contracts with permanenceStartDate...');
  
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ['ACTIVO', 'TRAMITANDO'] },
      permanenceStartDate: { not: null },
      expectedEndDate: null
    },
    include: {
      product: { select: { permanenceMonths: true } }
    }
  });

  console.log(`Found ${contracts.length} contracts to update.`);

  let updated = 0;
  for (const contract of contracts) {
    const start = new Date(contract.permanenceStartDate!);
    const durationMonths = contract.duration || contract.product?.permanenceMonths || 12;
    
    // Calculate expected end date by adding months
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);
    
    await prisma.contract.update({
      where: { id: contract.id },
      data: { 
        expectedEndDate: end,
        duration: durationMonths
      }
    });
    
    updated++;
    if (updated % 500 === 0) {
      console.log(`Updated ${updated} contracts...`);
    }
  }

  console.log(`Finished updating ${updated} contracts.`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
