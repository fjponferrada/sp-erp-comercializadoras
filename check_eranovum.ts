import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const lead = await prisma.lead.findFirst({
    where: {
      businessName: {
        contains: 'ERANOVUM'
      }
    }
  });
  const data: any = lead?.airtableData;
  console.log({
    "CANAL": data?.["CANAL"],
    "Comercial": data?.["Comercial"],
    "Código comercial": data?.["Código comercial"],
    "Email Comercial": data?.["Email Comercial"]
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
