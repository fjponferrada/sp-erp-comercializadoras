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
  console.log("Iniciando migración de IBANs a SupplyPoint...");

  // 1. Fetch all Airtable contracts
  console.log("Descargando Contratos de Airtable para mapear IBAN...");
  const contractsRecord = await base('CONTRATOS').select().all();
  console.log(`Obtenidos ${contractsRecord.length} contratos de Airtable.`);

  // 2. Map CUPS -> Latest IBAN from Airtable
  const cupsToIban = new Map<string, string>();
  const cupsToDate = new Map<string, Date>();

  for (const record of contractsRecord) {
    const f = record.fields as any;
    const cups = f['CUPS']?.[0] || f['CUPS_String']; 
    // Sometimes CUPS is an array from a linked record, sometimes a string.
    let actualCups = Array.isArray(cups) ? cups[0] : cups;
    
    // Fallback: If Airtable gave us CUPS as a string
    if (actualCups && typeof actualCups === 'string' && f['IBAN']) {
      const iban = f['IBAN'].toString();
      const createdAt = new Date(record._rawJson.createdTime);
      
      // Keep the most recent IBAN for a given CUPS
      const existingDate = cupsToDate.get(actualCups);
      if (!existingDate || createdAt > existingDate) {
        cupsToIban.set(actualCups, iban);
        cupsToDate.set(actualCups, createdAt);
      }
    }
  }

  console.log(`Mapeados ${cupsToIban.size} CUPS con IBAN desde Airtable directamente.`);

  // 3. Migrate in Prisma
  const supplyPoints = await prisma.supplyPoint.findMany({
    include: {
      client: true,
      contracts: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  console.log(`Procesando ${supplyPoints.length} Puntos de Suministro locales...`);

  let updatedCount = 0;

  for (const sp of supplyPoints) {
    let finalIban: string | null = null;
    let finalMandateSigned: boolean = false;
    let finalPaymentMethod: string | null = null;

    // 3A. Prioridad 1: Airtable directo por CUPS
    if (cupsToIban.has(sp.cups)) {
      finalIban = cupsToIban.get(sp.cups)!;
    }

    // 3B. Prioridad 2: Prisma Contract más reciente
    if (!finalIban && sp.contracts && sp.contracts.length > 0) {
      for (const contract of sp.contracts) {
        if ((contract as any).iban) {
          finalIban = (contract as any).iban;
          break;
        }
      }
    }

    // 3C. Prioridad 3: Prisma Client (legacy)
    if (!finalIban && (sp.client as any).iban) {
      finalIban = (sp.client as any).iban;
      finalMandateSigned = (sp.client as any).mandateSigned || false;
      finalPaymentMethod = (sp.client as any).paymentMethod || null;
    }

    if (finalIban) {
      await prisma.supplyPoint.update({
        where: { id: sp.id },
        data: {
          iban: finalIban,
          mandateSigned: finalMandateSigned,
          paymentMethod: finalPaymentMethod,
        }
      });
      updatedCount++;
    }
  }

  console.log(`✅ Migración completada. ${updatedCount} Puntos de Suministro actualizados con IBAN.`);
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
