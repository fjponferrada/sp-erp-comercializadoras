import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const leads = await prisma.lead.findMany({ take: 2 });
  console.log(JSON.stringify(leads, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
