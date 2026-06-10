import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const allContracts = await prisma.contract.findMany({
    select: { id: true, contractCode: true, version: true, brandId: true }
  });

  const map = new Map<string, string[]>();
  for (const c of allContracts) {
    const key = `${c.contractCode}-${c.version}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c.id);
  }

  let duplicatesFound = 0;
  for (const [key, ids] of map.entries()) {
    if (ids.length > 1) {
      console.log(`DUPLICATE FOUND for [${key}]: ${ids.length} contracts with this combination.`);
      duplicatesFound++;
    }
  }

  console.log(`Total duplicate combinations: ${duplicatesFound}`);
}

run().finally(() => prisma.$disconnect());
