import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';
import { put } from '@vercel/blob';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function uploadAirtablePdfToBlob(airtableUrl: string, filename: string): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (!airtableUrl || !airtableUrl.includes('airtableusercontent.com')) return null;

  try {
    const res = await fetch(airtableUrl);
    if (!res.ok) {
      console.warn(`    [WARN] Error descargando PDF de Airtable para ${filename}: ${res.statusText}`);
      return null;
    }
    const buffer = await res.buffer();
    const blob = await put(`contratos_migracion/${filename}`, buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  } catch (err: any) {
    console.error(`    [ERROR] Fallo subiendo a Blob ${filename}:`, err.message);
    return null;
  }
}

async function run() {
  console.log("Iniciando Fase 2: Migración de PDFs desde Airtable hacia Vercel Blob...");

  const contracts = await prisma.contract.findMany({
    include: { supplyPoint: true }
  });

  console.log(`Encontrados ${contracts.length} contratos locales para procesar.`);

  let updatedCount = 0;

  for (const contract of contracts) {
    const f = contract.airtableData as any;
    if (!f) continue;

    let modified = false;

    const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
    const cups = contract.supplyPoint?.cups || 'SIN_CUPS';
    const baseFilename = `${sanitizeName(cups)}_${contract.airtableId || contract.id}`;

    console.log(`\nProcesando Contrato: ${baseFilename}`);

    if (f['PDF Contrato firmado'] && Array.isArray(f['PDF Contrato firmado']) && f['PDF Contrato firmado'].length > 0) {
      const oldUrl = f['PDF Contrato firmado'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Contrato Firmado a Vercel Blob...`);
        const newUrl = await uploadAirtablePdfToBlob(oldUrl, `${baseFilename}_firmado.pdf`);
        if (newUrl) {
          f['PDF Contrato firmado'][0].url = newUrl;
          modified = true;
        }
      }
    } else if (f['Contrato .PDF'] && Array.isArray(f['Contrato .PDF']) && f['Contrato .PDF'].length > 0) {
      const oldUrl = f['Contrato .PDF'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Contrato .PDF a Vercel Blob...`);
        const newUrl = await uploadAirtablePdfToBlob(oldUrl, `${baseFilename}_firmado.pdf`);
        if (newUrl) {
          f['Contrato .PDF'][0].url = newUrl;
          modified = true;
        }
      }
    }

    if (f['Borrador contrato'] && Array.isArray(f['Borrador contrato']) && f['Borrador contrato'].length > 0) {
      const oldUrl = f['Borrador contrato'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Borrador a Vercel Blob...`);
        const newUrl = await uploadAirtablePdfToBlob(oldUrl, `${baseFilename}_borrador.pdf`);
        if (newUrl) {
          f['Borrador contrato'][0].url = newUrl;
          modified = true;
        }
      }
    }

    if (f['PDF Anexo firmado'] && Array.isArray(f['PDF Anexo firmado']) && f['PDF Anexo firmado'].length > 0) {
      const oldUrl = f['PDF Anexo firmado'][0].url;
      if (oldUrl && oldUrl.includes('airtableusercontent.com')) {
        console.log(`    Subiendo Anexo Firmado a Vercel Blob...`);
        const newUrl = await uploadAirtablePdfToBlob(oldUrl, `${baseFilename}_anexo.pdf`);
        if (newUrl) {
          f['PDF Anexo firmado'][0].url = newUrl;
          modified = true;
        }
      }
    }

    if (modified) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { airtableData: f }
      });
      updatedCount++;
      console.log(`  -> Contrato actualizado exitosamente en BD.`);
    } else {
      console.log(`  -> No había URLs pendientes de subir para este contrato.`);
    }
  }

  console.log(`\n¡Fase 2 finalizada! ${updatedCount} contratos tuvieron sus PDFs migrados a Vercel Blob.`);
}

run()
  .catch(e => { console.error("Error fatal:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
