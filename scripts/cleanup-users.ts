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
  console.log("Cleaning up users...");
  
  // Reassign all leads and contracts back to the first available user (should be admin)
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!firstUser) {
    console.log("No users exist.");
    return;
  }
  console.log(`Reassigning to ${firstUser.email}`);
  await prisma.lead.updateMany({ data: { userId: firstUser.id } });
  await prisma.contract.updateMany({ data: { userId: firstUser.id } });
  await prisma.ticket.updateMany({ data: { createdById: firstUser.id } }).catch(()=>console.log("no tickets"));

  // Delete all users except the first one and superadmins
  const result = await prisma.user.deleteMany({
      where: {
          email: { notIn: [firstUser.email, 'fjponferrada@sp-energia.com', 'admin@migracion.com'] }
      }
  });
  console.log(`Deleted ${result.count} users.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
