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
  
  const distinctStates = new Set<string>();

  let fixed = 0;

  for (const c of contracts) {
    if (!c.airtableData || typeof c.airtableData !== 'object') continue;
    const f = c.airtableData as any;
    const airtableStatus = f['Estado'];

    if (airtableStatus) {
      const stateStr = airtableStatus.toString();
      const sUpper = stateStr.toUpperCase();
      
      if (sUpper.includes('RECHAZA') || sUpper.includes('RECHAZO')) {
        distinctStates.add(stateStr);
        
        let newStatus = 'RECHAZADO';
        
        if (sUpper.includes('DISTRIBUIDORA')) {
          newStatus = 'RECHAZO_DISTRIBUIDORA';
        } else if (sUpper.includes('COMERCIALIZADORA')) {
          newStatus = 'RECHAZO_COMERCIALIZADORA';
        } else if (sUpper.includes('RIESGO')) {
          newStatus = 'RECHAZO_RIESGOS';
        } else if (sUpper.includes('CLIENTE')) {
          newStatus = 'RECHAZADO_POR_CLIENTE';
        }
        
        if (c.status !== newStatus) {
          await prisma.contract.update({
            where: { id: c.id },
            data: { status: newStatus }
          });
          fixed++;
          console.log(`Contrato ${c.contractCode}: ${c.status} -> ${newStatus}`);
        }
      }
    }
  }

  console.log(`\nEstados detectados en Airtable:`, Array.from(distinctStates));
  console.log(`\nSe actualizaron ${fixed} contratos con el subestado correcto.`);
}

run().finally(() => process.exit(0));
