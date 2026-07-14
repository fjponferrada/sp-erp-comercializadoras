import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';
import { uploadFileToR2 } from '../src/lib/r2';

// Load .env fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function fetchAllAirtableRecords(baseUrl: string) {
  let allRecords: any[] = [];
  let offset = '';
  do {
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: "Bearer " + AIRTABLE_API_KEY } });
    if (!res.ok) {
      console.error("Error fetching Airtable:", await res.text());
      break;
    }
    const data = await res.json();
    if (data.records) allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);
  return allRecords;
}

async function uploadAirtablePdfToR2(airtableUrl: string, filename: string): Promise<string | null> {
  if (!process.env.R2_BUCKET_NAME) return null;
  if (!airtableUrl || !airtableUrl.includes('airtableusercontent.com')) return null;

  try {
    const res = await fetch(airtableUrl);
    if (!res.ok) {
      console.warn(`    [WARN] Error descargando PDF de Airtable para ${filename}: ${res.statusText}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await uploadFileToR2(`contratos_migracion/${filename}`, buffer, 'application/pdf');
    return url;
  } catch (err: any) {
    console.error(`    [ERROR] Fallo subiendo a R2 ${filename}:`, err.message);
    return null;
  }
}

async function run() {
  console.log("Iniciando Fase 2: Migración de PDFs desde Airtable hacia Cloudflare R2...");

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error("Faltan credenciales de Airtable en .env");
    process.exit(1);
  }

  console.log("1. Descargando datos FRESCOS de Airtable para obtener URLs no caducadas...");
  const contratosUrl = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/CONTRATOS?filterByFormula=" + encodeURIComponent('NOT({CUPS}="")');
  const freshAirtableRecords = await fetchAllAirtableRecords(contratosUrl);
  console.log(`Descargados ${freshAirtableRecords.length} contratos frescos de Airtable.`);
  
  const freshMap = new Map(freshAirtableRecords.map(r => [r.id, r.fields]));

  const contracts = await prisma.contract.findMany({
    include: { supplyPoint: true }
  });

  console.log(`2. Cruzando con ${contracts.length} contratos locales para procesar PDFs...`);

  let updatedCount = 0;

  for (const contract of contracts) {
    const localData = contract.airtableData as any;
    if (!localData || !contract.airtableId) continue;

    // Usamos los campos FRESCOS de Airtable si existen, si no, fall back al local (que probablemente esté caducado)
    const f = freshMap.get(contract.airtableId) || localData;
    let modified = false;

    const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    const cups = contract.supplyPoint?.cups || 'SIN_CUPS';
    const baseFilename = `${sanitizeName(cups)}_${contract.airtableId}`;

    console.log(`\nProcesando Contrato: ${baseFilename}`);

    if (f['PDF Contrato firmado'] && Array.isArray(f['PDF Contrato firmado']) && f['PDF Contrato firmado'].length > 0) {
      const oldUrl = f['PDF Contrato firmado'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Contrato Firmado a R2...`);
        const newUrl = await uploadAirtablePdfToR2(oldUrl, `${baseFilename}_firmado.pdf`);
        if (newUrl) {
          localData['PDF Contrato firmado'] = [{ url: newUrl }];
          modified = true;
        }
      }
    } else if (f['Contrato .PDF'] && Array.isArray(f['Contrato .PDF']) && f['Contrato .PDF'].length > 0) {
      const oldUrl = f['Contrato .PDF'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Contrato .PDF a R2...`);
        const newUrl = await uploadAirtablePdfToR2(oldUrl, `${baseFilename}_firmado.pdf`);
        if (newUrl) {
          localData['Contrato .PDF'] = [{ url: newUrl }];
          modified = true;
        }
      }
    }

    if (f['Borrador contrato'] && Array.isArray(f['Borrador contrato']) && f['Borrador contrato'].length > 0) {
      const oldUrl = f['Borrador contrato'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Borrador a R2...`);
        const newUrl = await uploadAirtablePdfToR2(oldUrl, `${baseFilename}_borrador.pdf`);
        if (newUrl) {
          localData['Borrador contrato'] = [{ url: newUrl }];
          modified = true;
        }
      }
    }

    if (f['PDF Anexo firmado'] && Array.isArray(f['PDF Anexo firmado']) && f['PDF Anexo firmado'].length > 0) {
      const oldUrl = f['PDF Anexo firmado'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Anexo Firmado a R2...`);
        const newUrl = await uploadAirtablePdfToR2(oldUrl, `${baseFilename}_anexo.pdf`);
        if (newUrl) {
          localData['PDF Anexo firmado'] = [{ url: newUrl }];
          modified = true;
        }
      }
    }

    if (modified) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { airtableData: localData }
      });
      updatedCount++;
      console.log(`  -> Contrato actualizado exitosamente en BD.`);
    } else {
      console.log(`  -> No había URLs pendientes de subir para este contrato (o ya migradas).`);
    }
  }

  console.log(`\n¡Fase 2 finalizada! ${updatedCount} contratos tuvieron sus PDFs migrados a Cloudflare R2.`);
}

run()
  .catch(e => { console.error("Error fatal:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
