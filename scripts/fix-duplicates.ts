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

  const map = new Map<string, any[]>();
  for (const c of allContracts) {
    const key = `${c.contractCode}-${c.version}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  let bumped = 0;
  for (const [key, contracts] of map.entries()) {
    if (contracts.length > 1) {
      // Find the one with brandId = null
      const orphan = contracts.find(c => c.brandId === null);
      if (orphan) {
        // Bump its version to 99 to avoid clash
        console.log(`Bumping orphan ${orphan.id} (code: ${orphan.contractCode}) to version 99`);
        await prisma.contract.update({
          where: { id: orphan.id },
          data: { version: 99 }
        });
        bumped++;
      }
    }
  }

  console.log(`Fixed ${bumped} duplicates.`);
}

run().finally(() => prisma.$disconnect());
