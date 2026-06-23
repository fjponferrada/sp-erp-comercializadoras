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
  const f1 = await prisma.f1Invoice.findFirst({
    where: { tipoDocumento: 'FacturaATR' },
    select: { jsonData: true }
  });
  console.log(JSON.stringify(f1?.jsonData, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
