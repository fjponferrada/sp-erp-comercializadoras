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
    const airtableStatus = f['Estado'];

    if (airtableStatus) {
      let status = 'TRAMITANDO';
      const sUpper = airtableStatus.toString().toUpperCase();
      if (sUpper.includes('ACTIVO')) status = 'ACTIVO';
      else if (sUpper.includes('BAJA')) status = 'BAJA';
      else if (sUpper.includes('BORRADOR')) status = 'BORRADOR';
      else if (sUpper.includes('RECHAZA') || sUpper.includes('RECHAZO')) status = 'RECHAZADO';
      else if (sUpper.includes('ACEPTAD')) status = 'ACEPTADO';
      else if (sUpper.includes('FINALIZ')) status = 'FINALIZADO';

      if (c.status !== status) {
        await prisma.contract.update({
          where: { id: c.id },
          data: { status }
        });
        fixed++;
        console.log(`Contrato ${c.contractCode}: ${c.status} -> ${status} (Airtable: ${airtableStatus})`);
      }
    }
  }

  console.log(`Se actualizaron ${fixed} contratos con el estado correcto.`);
}

run().finally(() => process.exit(0));
