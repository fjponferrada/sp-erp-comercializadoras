import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const oldId = 'cmq31145a0001xc41vh7jfoln';
  const newId = 'cmq3szhmh0000ag41tq695ubj';

  await prisma.user.updateMany({
    where: { brandId: oldId },
    data: { brandId: newId }
  });
  await prisma.client.updateMany({
    where: { brandId: oldId },
    data: { brandId: newId }
  });
  await prisma.product.updateMany({
    where: { brandId: oldId },
    data: { brandId: newId }
  });
  // Removed channel update

  const users = await prisma.user.findMany({
    where: { assignedBrands: { some: { id: oldId } } }
  });
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        assignedBrands: {
          disconnect: { id: oldId },
          connect: { id: newId }
        }
      }
    });
  }

  await prisma.brand.delete({
    where: { id: oldId }
  });

  console.log("Deleted old brand.");
}

run().catch(console.error).finally(() => prisma.$disconnect());
