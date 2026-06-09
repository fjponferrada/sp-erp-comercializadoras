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
  const client = await prisma.client.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log("Último Cliente importado:");
  console.log(JSON.stringify(client, null, 2));

  const sp = await prisma.supplyPoint.findFirst({
    orderBy: { cups: 'desc' }
  });
  console.log("Último CUPS importado:");
  console.log(JSON.stringify(sp, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
