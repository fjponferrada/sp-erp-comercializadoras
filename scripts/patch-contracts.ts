import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function fetchAirtableVersions() {
  let allRecords: any[] = [];
  let offset = "";
  let hasMore = true;

  // Solo pedimos el campo "Version", lo que hace que la descarga sea instantánea
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CONTRATOS?fields%5B%5D=Version&filterByFormula=` + encodeURIComponent('NOT({CUPS}="")');

  while (hasMore) {
    const url = offset ? `${baseUrl}&offset=${offset}` : baseUrl;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    
    if (!response.ok) {
      console.error(`Error Airtable: ${response.status} ${response.statusText}`);
      break;
    }
    const data = await response.json();
    allRecords = allRecords.concat(data.records);
    
    if (data.offset) {
      offset = data.offset;
    } else {
      hasMore = false;
    }
  }
  return allRecords;
}

async function run() {
  console.log("Iniciando parche de Contratos (Versión y BrandId)...");

  // 1. Descargar las versiones de Airtable
  console.log("\n1. Descargando campo Versión de Airtable (súper rápido)...");
  const records = await fetchAirtableVersions();
  console.log(`✅ Se han descargado ${records.length} registros de Airtable.`);

  // 2. Actualizar los contratos existentes con sus versiones reales
  console.log("\n2. Actualizando versiones en la base de datos local...");
  let count = 0;
  for (const record of records) {
    const versionVal = parseInt(record.fields['Version'] || '0', 10);
    const version = isNaN(versionVal) ? 0 : versionVal;

    if (version > 0) {
      await prisma.contract.updateMany({
        where: { airtableId: record.id },
        data: { version }
      });
      count++;
    }
  }
  console.log(`✅ Se han actualizado a su versión correcta ${count} contratos.`);

  // 3. Asignar BrandId a los contratos huérfanos
  console.log("\n3. Asignando BrandId a los contratos huérfanos...");
  const brand = await prisma.brand.findFirst({ where: { name: 'AED Energía' } });
  if (brand) {
    const updatedBrands = await prisma.contract.updateMany({
      where: { brandId: null },
      data: { brandId: brand.id }
    });
    console.log(`✅ Se han asignado la marca AED a ${updatedBrands.count} contratos huérfanos.`);
  }

  console.log("\n¡Parche aplicado con éxito en tiempo récord!");
}

run().catch(e => { console.error("Error fatal:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
