import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import Airtable from 'airtable';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

import { uploadFileToR2 } from '../src/lib/r2.js';

async function uploadAirtablePdfToR2(airtableUrl: string, filename: string): Promise<string | null> {
  try {
    const res = await fetch(airtableUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return await uploadFileToR2(`contratos_migracion/${filename}`, buffer, 'application/pdf');
  } catch (err: any) {
    console.error("Error uploadAirtablePdfToR2:", err.message);
    return null;
  }
}

async function run() {
  console.log("Buscando contratos con URLs de Airtable residuales...");
  const contracts = await prisma.contract.findMany({
    where: { airtableData: { not: null } },
    include: { supplyPoint: true }
  });

  let count = 0;

  for (const contract of contracts) {
    const data = contract.airtableData as any;
    const hasAirtableUrl = JSON.stringify(data).includes('airtableusercontent.com');
    
    if (hasAirtableUrl && contract.airtableId) {
      console.log(`Procesando residual: ${contract.contractCode || contract.id}`);
      
      try {
        const record = await base('Contratos').find(contract.airtableId);
        const f = record.fields as any;
        
        let modified = false;
        const sanitizeName = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
        const cups = contract.supplyPoint?.cups || 'SIN_CUPS';
        const baseFilename = `${sanitizeName(cups)}_${contract.airtableId}`;

        if (f['PDF Contrato firmado'] && Array.isArray(f['PDF Contrato firmado']) && f['PDF Contrato firmado'].length > 0) {
          const url = await uploadAirtablePdfToR2(f['PDF Contrato firmado'][0].url, `${baseFilename}_firmado.pdf`);
          if (url) { data['PDF Contrato firmado'] = [{ url }]; modified = true; }
        }
        if (f['Contrato .PDF'] && Array.isArray(f['Contrato .PDF']) && f['Contrato .PDF'].length > 0) {
          const url = await uploadAirtablePdfToR2(f['Contrato .PDF'][0].url, `${baseFilename}_firmado.pdf`);
          if (url) { data['Contrato .PDF'] = [{ url }]; modified = true; }
        }
        if (f['Borrador contrato'] && Array.isArray(f['Borrador contrato']) && f['Borrador contrato'].length > 0) {
          const url = await uploadAirtablePdfToR2(f['Borrador contrato'][0].url, `${baseFilename}_borrador.pdf`);
          if (url) { data['Borrador contrato'] = [{ url }]; modified = true; }
        }
        if (f['PDF Anexo firmado'] && Array.isArray(f['PDF Anexo firmado']) && f['PDF Anexo firmado'].length > 0) {
          const url = await uploadAirtablePdfToR2(f['PDF Anexo firmado'][0].url, `${baseFilename}_anexo.pdf`);
          if (url) { data['PDF Anexo firmado'] = [{ url }]; modified = true; }
        }

        if (modified) {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { airtableData: data }
          });
          count++;
          console.log(` -> Actualizado correctamente`);
        }
      } catch (err: any) {
        if (err.statusCode === 404) {
          // Record was deleted in Airtable, ignore
        } else {
          console.error(` -> Error con Airtable: ${err.message}`);
        }
      }
    }
  }

  console.log(`¡Finalizado! ${count} contratos residuales arreglados.`);
}

run().finally(() => prisma.$disconnect());
