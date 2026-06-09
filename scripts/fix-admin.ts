import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function fix() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@migracion.com' } });
  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { email: 'fjponferrada@sp-energia.com', name: 'FJ Ponferrada' }
    });
    console.log("Admin email updated successfully.");
  } else {
    console.log("Admin not found, skipping update.");
  }
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
