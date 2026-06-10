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
  console.log('Fetching active/tramitando contracts with expectedEndDate...');
  
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ['ACTIVO', 'TRAMITANDO'] },
      expectedEndDate: { not: null }
    }
  });

  console.log(`Found ${contracts.length} contracts to update.`);

  let updated = 0;
  for (const contract of contracts) {
    if (!contract.expectedEndDate) continue;
    
    // Subtract 1 day
    const end = new Date(contract.expectedEndDate);
    end.setDate(end.getDate() - 1);
    
    await prisma.contract.update({
      where: { id: contract.id },
      data: { 
        expectedEndDate: end
      }
    });
    
    updated++;
    if (updated % 500 === 0) {
      console.log(`Updated ${updated} contracts...`);
    }
  }

  console.log(`Finished updating ${updated} contracts by subtracting 1 day.`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
