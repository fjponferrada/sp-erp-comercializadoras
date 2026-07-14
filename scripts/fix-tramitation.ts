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
  const contracts = await prisma.contract.findMany({
    where: { tramitationType: null }
  });

  let count = 0;
  for (const contract of contracts) {
    if (contract.airtableData) {
      const f: any = contract.airtableData;
      const tramitationRaw = f['Tramitación a realizar'] || f['Tipo'];
      if (tramitationRaw) {
        const tramitationType = Array.isArray(tramitationRaw) ? tramitationRaw[0].toString() : tramitationRaw.toString();
        await prisma.contract.update({
          where: { id: contract.id },
          data: { tramitationType }
        });
        count++;
      }
    }
  }

  console.log(`Actualizados ${count} contratos con su tipo de tramitación original.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
