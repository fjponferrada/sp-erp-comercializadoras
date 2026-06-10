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
  console.log("Asignando BrandId de forma segura (uno a uno)...");
  const brand = await prisma.brand.findFirst({ where: { name: 'AED Energía' } });
  if (!brand) return;

  const orphans = await prisma.contract.findMany({
    where: { brandId: null },
    select: { id: true, contractCode: true, version: true }
  });

  let success = 0;
  let failed = 0;

  for (const orphan of orphans) {
    try {
      await prisma.contract.update({
        where: { id: orphan.id },
        data: { brandId: brand.id }
      });
      success++;
    } catch (e) {
      console.log(`Failed to update ${orphan.id} (Code: ${orphan.contractCode}, Version: ${orphan.version})`);
      failed++;
    }
  }

  console.log(`Done. Success: ${success}, Failed: ${failed}`);
}

run().finally(() => prisma.$disconnect());
