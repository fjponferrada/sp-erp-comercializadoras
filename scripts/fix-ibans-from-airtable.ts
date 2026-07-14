import { PrismaClient } from '@prisma/client';
import Airtable from 'airtable';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

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

async function run() {
  console.log("Iniciando reparación de IBANs desde Airtable...");

  // 1. Fetch all Airtable contracts
  console.log("Descargando TODOS los Contratos de Airtable...");
  const contractsRecord = await base('CONTRATOS').select().all();
  console.log(`Obtenidos ${contractsRecord.length} contratos de Airtable.`);

  // 2. Map CUPS -> Latest IBAN from Airtable
  const cupsToIban = new Map<string, string>();
  const cupsToDate = new Map<string, Date>();

  for (const record of contractsRecord) {
    const f = record.fields as any;
    
    // El campo CUPS puede ser un Array (si hay varios) o un string, o puede estar en CUPS_String
    let rawCups = f['CUPS'] || f['CUPS_String'];
    if (!rawCups) continue;
    
    const cupsArray = Array.isArray(rawCups) ? rawCups : [rawCups];
    
    const iban = f['IBAN'] || f['Certificado IBAN'];
    if (!iban) continue;

    const createdAt = new Date(record._rawJson.createdTime);

    for (const c of cupsArray) {
      if (typeof c !== 'string') continue;
      const cleanCups = c.toString().trim();
      if (!cleanCups) continue;

      const existingDate = cupsToDate.get(cleanCups);
      // Si no existe, o si este contrato es más reciente, nos quedamos con su IBAN
      if (!existingDate || createdAt > existingDate) {
        cupsToIban.set(cleanCups, iban.toString().trim());
        cupsToDate.set(cleanCups, createdAt);
      }
    }
  }

  console.log(`Mapeados ${cupsToIban.size} CUPS con su IBAN más reciente desde Airtable.`);

  // 3. Migrate in Prisma
  const supplyPoints = await prisma.supplyPoint.findMany();
  console.log(`Procesando ${supplyPoints.length} Puntos de Suministro locales...`);

  let updatedCount = 0;

  for (const sp of supplyPoints) {
    const latestAirtableIban = cupsToIban.get(sp.cups);
    
    if (latestAirtableIban && latestAirtableIban !== sp.iban) {
      await prisma.supplyPoint.update({
        where: { id: sp.id },
        data: { iban: latestAirtableIban }
      });
      updatedCount++;
      console.log(`[OK] CUPS ${sp.cups} actualizado: IBAN anterior -> ${sp.iban || 'NULL'}, Nuevo IBAN -> ${latestAirtableIban}`);
    }
  }

  console.log(`\n¡Completado! Se han reparado ${updatedCount} IBANs en Puntos de Suministro.`);
  process.exit(0);
}

run().catch((e) => {
  console.error("Error ejecutando reparación:", e);
  process.exit(1);
});
