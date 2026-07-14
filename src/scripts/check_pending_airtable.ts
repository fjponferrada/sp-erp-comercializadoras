import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error("Faltan credenciales de Airtable en .env");
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

async function checkPending() {
  console.log("Iniciando escaneo rápido de contratos pendientes de Airtable (DRY RUN)...");
  
  console.log("Cargando IDs existentes en ERP...");
  const existingContracts = await prisma.contract.findMany({
    where: { airtableId: { not: null } },
    select: { airtableId: true }
  });
  const existingIds = new Set(existingContracts.map(c => c.airtableId));
  console.log(`Tenemos ${existingIds.size} contratos mapeados con Airtable en la BD local.`);

  console.log("Obteniendo registros de Airtable...");
  const records = await base('CONTRATOS').select().all();
  console.log(`Se encontraron ${records.length} contratos en Airtable. Comparando...`);
  
  const pendingDetails: any[] = [];
  
  for (const record of records) {
    if (!existingIds.has(record.id)) {
      pendingDetails.push({
        id: record.id,
        cliente: record.get('NOMBRE TITULAR') || record.get('CLIENTE') || 'Desconocido',
        cif: record.get('CIF') || record.get('NIF') || 'Sin CIF',
        cups: record.get('CUPS') || 'Sin CUPS',
        estado: record.get('ESTADO') || 'Sin estado'
      });
    }
  }
  
  console.log("\n--- RESULTADO DEL ESCANEO ---");
  console.log(`Contratos TOTALES en Airtable: ${records.length}`);
  console.log(`Contratos PENDIENTES de importar: ${pendingDetails.length}`);
  
  if (pendingDetails.length > 0) {
    console.log(`\nPrimeros ${Math.min(20, pendingDetails.length)} contratos pendientes encontrados:`);
    pendingDetails.slice(0, 20).forEach((p, idx) => {
      console.log(`${idx + 1}. Cliente: ${p.cliente} | CIF: ${p.cif} | CUPS: ${p.cups} | Estado: ${p.estado}`);
    });
  }
  
  process.exit(0);
}

checkPending().catch(e => {
  console.error(e);
  process.exit(1);
});
