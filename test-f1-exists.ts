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
  const f1 = await prisma.f1Invoice.findMany({
    where: { numeroFactura: { contains: '171261N067383919' } }
  });
  console.log("Found F1s with 171261N067383919:", f1.length);
  f1.forEach(f => console.log(f.numeroFactura, f.tipoDocumento, f.saldoFactura));
}

run().catch(console.error).finally(() => prisma.$disconnect());
