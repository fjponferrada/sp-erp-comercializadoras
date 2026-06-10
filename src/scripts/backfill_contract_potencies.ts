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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("Iniciando reparación de potencias de contratos desde Airtable...");

  // Get all contracts from local DB that have an airtableId and missing p1c
  // (We'll just fetch all contracts with an airtableId to be safe and ensure all versions are synced)
  const localContracts = await prisma.contract.findMany({
    where: {
      airtableId: { not: null }
    },
    select: { id: true, airtableId: true, p1c: true, contractCode: true, version: true }
  });

  console.log(`Encontrados ${localContracts.length} contratos locales con airtableId.`);

  // To avoid hitting API limits, we'll download all Airtable contracts with only P1C-P6C fields
  console.log("Descargando potencias de TODOS los contratos de Airtable...");
  const contractsRecord = await base('CONTRATOS').select({
    fields: ['P1C', 'P2C', 'P3C', 'P4C', 'P5C', 'P6C', 'Version']
  }).all();

  const airtableContractsMap = new Map();
  for (const r of contractsRecord) {
    airtableContractsMap.set(r.id, r.fields);
  }

  console.log(`✅ Obtenidos ${airtableContractsMap.size} contratos de Airtable.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  for (const localContract of localContracts) {
    const airtableId = localContract.airtableId;
    if (!airtableId) continue;

    const airtableData = airtableContractsMap.get(airtableId);
    if (!airtableData) {
      notFoundCount++;
      continue;
    }

    // Extraer potencias (asumiendo que vienen como texto o número)
    const p1c = airtableData['P1C'] ? parseFloat(airtableData['P1C']) : null;
    const p2c = airtableData['P2C'] ? parseFloat(airtableData['P2C']) : null;
    const p3c = airtableData['P3C'] ? parseFloat(airtableData['P3C']) : null;
    const p4c = airtableData['P4C'] ? parseFloat(airtableData['P4C']) : null;
    const p5c = airtableData['P5C'] ? parseFloat(airtableData['P5C']) : null;
    const p6c = airtableData['P6C'] ? parseFloat(airtableData['P6C']) : null;

    // Si ya tiene P1C (y asumimos que es correcto) y el usuario no forzó la sobreescritura, podríamos omitir.
    // Pero como queremos forzar el arreglo de la trazabilidad en TODAS las versiones, sobreescribimos.

    await prisma.contract.update({
      where: { id: localContract.id },
      data: {
        p1c, p2c, p3c, p4c, p5c, p6c
      }
    });

    updatedCount++;
    if (updatedCount % 100 === 0) {
      console.log(`Progreso: ${updatedCount} contratos actualizados...`);
    }
  }

  console.log("-----------------------------------------");
  console.log("¡REPARACIÓN FINALIZADA CON ÉXITO!");
  console.log(`Contratos actualizados: ${updatedCount}`);
  console.log(`Contratos omitidos (ya estaban OK): ${skippedCount}`);
  console.log(`Contratos no encontrados en Airtable: ${notFoundCount}`);
}

run().catch(e => {
  console.error("Fatal Error:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
