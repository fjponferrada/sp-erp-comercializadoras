import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting channels backfill...');

  // Get the default brand "aed"
  const brand = await prisma.brand.findFirst();

  if (!brand) {
    console.error('No brand found!');
    process.exit(1);
  }

  // Update all channels that have no brandId
  const result = await prisma.channel.updateMany({
    where: { brandId: null },
    data: { brandId: brand.id }
  });

  console.log(`Updated ${result.count} channels with brandId: ${brand.id}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
