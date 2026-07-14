import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const contracts = await prisma.contract.findMany();
  let fixed = 0;

  for (const c of contracts) {
    if (!c.airtableData || typeof c.airtableData !== 'object') continue;
    const f = c.airtableData as any;
    
    // El campo puede llamarse "Observaciones" o "OBSERVACIONES" o similar
    const obs = f['Observaciones'] || f['OBSERVACIONES'];

    if (obs && typeof obs === 'string' && obs.trim() !== '') {
      if (c.internalComments !== obs.trim()) {
        await prisma.contract.update({
          where: { id: c.id },
          data: { internalComments: obs.trim() }
        });
        fixed++;
        console.log(`Contrato ${c.contractCode || c.id} observaciones actualizadas.`);
      }
    }
  }

  console.log(`\nSe actualizaron ${fixed} contratos con sus observaciones.`);
}

run().finally(() => process.exit(0));
