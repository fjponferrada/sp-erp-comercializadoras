import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Airtable from 'airtable';
import { uploadFileToR2 } from '../lib/r2';
import crypto from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C';

if (!AIRTABLE_API_KEY) {
  console.error('ERROR: Falta configurar AIRTABLE_API_KEY en el archivo .env');
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

/**
 * Función inteligente de Cajón Documental
 * Descarga el archivo, calcula el MD5 y si ya existe un documento con ese MD5
 * para el mismo cliente o CUPS, lo enlaza sin duplicarlo.
 */
async function processSmartDocument(
  url: string,
  filename: string,
  type: string,
  clientId?: string,
  supplyPointId?: string,
  leadId?: string
) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Calcular huella digital (MD5)
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const sizeBytes = buffer.length;

    // Buscar si ya existe este mismo archivo para este cliente/CUPS
    const existingDoc = await prisma.document.findFirst({
      where: {
        hash,
        OR: [
          { clientId: clientId || undefined },
          { supplyPointId: supplyPointId || undefined }
        ]
      }
    });

    if (existingDoc) {
      console.log(`♻️ Deduplicado: El archivo ${filename} ya existía. Enlazando copia existente.`);
      // Enlazamos la entidad actual al documento existente (si venía de un lead, lo añadimos, etc)
      // En un diseño real puramente N a M haríamos una tabla puente, pero aquí lo clonamos
      // lógicamente con la misma URL para ahorrar Storage en Vercel Blob.
      return await prisma.document.create({
        data: {
          name: filename,
          type,
          url: existingDoc.url,
          sizeBytes: existingDoc.sizeBytes,
          hash: existingDoc.hash,
          clientId,
          supplyPointId,
          leadId
        }
      });
    }

    // Si no existe, lo subimos a Cloudflare R2
    let finalUrl = url;
    if (process.env.R2_BUCKET_NAME) {
      const r2Url = await uploadFileToR2(`documentos/${type.toLowerCase()}/${filename}`, buffer, 'application/octet-stream');
      finalUrl = r2Url;
    }

    // Registramos en el cajón documental
    return await prisma.document.create({
      data: {
        name: filename,
        type,
        url: finalUrl,
        sizeBytes,
        hash,
        clientId,
        supplyPointId,
        leadId
      }
    });
    
  } catch (err) {
    console.error(`Error procesando documento ${filename}:`, err);
    return null;
  }
}

async function migrateLeadsAndContracts() {
  console.log('Iniciando extracción V2 con Gestor Documental y Flujo Unificado...');
  
  const defaultUser = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
  const defaultBrand = await prisma.brand.findFirst();

  if (!defaultUser || !defaultBrand) throw new Error("Falta usuario o marca por defecto.");

  // Limitado a 10 para pruebas seguras
  const records = await base('LEADS').select({ maxRecords: 10 }).all();

  for (const record of records) {
    const fields = record.fields;
    const airtableId = record.id;
    
    // Datos del Cliente (Titular)
    const nifTitular = fields['NIF Titular'] as string;
    const razonSocial = fields['Nombre / Razón social Titular'] as string || '';
    const ape1 = fields['Primer apellido Titular'] as string || '';
    const ape2 = fields['Segundo apellido Titular'] as string || '';
    const fullNameTitular = `${razonSocial} ${ape1} ${ape2}`.trim() || 'Sin Nombre';
    
    // Datos del Representante/Contacto
    const nombreContacto = fields['Nombre Contacto'] as string || '';
    const apeContacto = fields['Apellidos Contacto'] as string || '';

    const businessName = fullNameTitular;
    const vatNumber = nifTitular || `PENDING-${airtableId}`;
    const email = (fields['Email Contacto'] as string) || (fields['Email'] as string);
    const phone = (fields['Teléfono Contacto'] as number)?.toString();
    const cups = (fields['CUPS'] as string);
    const estadoAirtable = (fields['Estado'] as string) || 'NUEVO';
    
    await prisma.$transaction(async (tx) => {
      // 1. Cliente Unificado (con airtableId para trazar)
      const client = await tx.client.upsert({
        where: { vatNumber_brandId: { vatNumber, brandId: defaultBrand.id } },
        update: { airtableId, businessName }, 
        create: {
          vatNumber,
          businessName,
          contactEmail: email,
          contactPhone: phone,
          brandId: defaultBrand.id,
          airtableId
        }
      });
      
      // 2. Suministro (CUPS)
      let supplyPoint = null;
      if (cups) {
        supplyPoint = await tx.supplyPoint.findFirst({ where: { cups, client: { brandId: defaultBrand.id } } });
        if (supplyPoint) {
          supplyPoint = await tx.supplyPoint.update({ where: { id: supplyPoint.id }, data: { airtableId } });
        } else {
          supplyPoint = await tx.supplyPoint.create({
            data: {
              cups,
              address: 'Extraído Airtable',
              city: 'Sin Ciudad',
              postalCode: '00000',
              province: 'Sin Provincia',
              tariff: '2.0TD',
              clientId: client.id,
              airtableId
            }
          });
        }
      }
      
      // 3. Crear Lead vinculado al Cliente y al CUPS (Arquitectura V2)
      // Omitimos la tabla de Contratos directos para respetar el "Flujo Unificado"
      const existingLead = await tx.lead.findFirst({ where: { airtableId } });
      const leadData = {
        businessName,
        firstName: nombreContacto,
        lastName: apeContacto,
        vatNumber: vatNumber.includes('PENDING') ? null : vatNumber,
        email,
        phone,
        status: estadoAirtable,
        cups,
        userId: defaultUser.id,
        airtableId
      };
      
      const lead = existingLead 
        ? await tx.lead.update({ where: { id: existingLead.id }, data: leadData })
        : await tx.lead.create({ data: leadData });

      // 4. Cajón Documental: Simulación de descarga de un archivo adjunto
      // En un entorno real se extraería del array de attachments de Airtable
      const dnisAdjuntos = fields['DNI Adjunto'] as any[];
      if (dnisAdjuntos && dnisAdjuntos.length > 0) {
        for (const doc of dnisAdjuntos) {
          await processSmartDocument(doc.url, doc.filename, 'DNI', client.id, undefined, lead.id);
        }
      }
      
    });
    
    console.log(`✅ Registro ${airtableId} migrado y vinculado con éxito.`);
  }
  
  console.log('Migración V2 finalizada correctamente.');
}

migrateLeadsAndContracts()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
