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
  const result = await prisma.$queryRaw`
    SELECT SUM((p->>'ValorEnergiaActiva')::numeric) as total_energia
    FROM "F1Invoice" f
    CROSS JOIN jsonb_array_elements(
      CASE 
        WHEN jsonb_typeof(f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'->'Periodo') = 'array' 
        THEN f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'->'Periodo'
        ELSE '[]'::jsonb
      END
    ) as p
    WHERE NOT EXISTS (
      SELECT 1 FROM "Invoice" i WHERE i."f1InvoiceId" = f.id
    )
  `;
  console.log(result);
}

run().catch(console.error).finally(() => prisma.$disconnect());
