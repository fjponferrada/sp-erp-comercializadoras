import Airtable from 'airtable';
import path from 'path';
import 'dotenv/config';
import { prisma } from '../lib/prisma';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

function parseDateSafe(val: any) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function run() {
  console.log("Iniciando REPARACIÓN RÁPIDA DE CONTRATOS de Airtable...");

  let brand = await prisma.brand.findFirst({ where: { slug: 'aed-energia' } });
  let superAdmin = await prisma.user.findFirst({ where: { email: 'fjponferrada@sp-energia.com' } });
  if (!brand || !superAdmin) throw new Error("Dependencias base no encontradas");

  console.log("Descargando TODOS los contratos para ver cuáles faltan...");
  const contractsRecord = await base('CONTRATOS').select().all();
  const contracts = contractsRecord.map(r => ({ id: r.id, fields: r.fields as any }));
  
  let fixedCount = 0;
  
  for (const record of contracts) {
    const f = record.fields;
    const contractCode = f['CONTRATO'] || `CC_${record.id}`;
    
    let contract = await prisma.contract.findUnique({ 
        where: { airtableId: record.id },
        include: { supplyPoint: true, client: true }
    });

    let clientAirtableId = f['CIF link'] ? f['CIF link'][0] : null;
    let supplyAirtableId = f['INSTALACIONES_LINK'] ? f['INSTALACIONES_LINK'][0] : null;

    let needsFix = false;
    if (!contract) needsFix = true;
    else {
        if (contract.clientId !== contract.supplyPoint.clientId) needsFix = true;
        if (clientAirtableId && contract.client?.airtableId && contract.client.airtableId !== clientAirtableId) needsFix = true;
        if (supplyAirtableId && contract.supplyPoint?.airtableId && contract.supplyPoint.airtableId !== supplyAirtableId) needsFix = true;
    }

    if (!needsFix) continue;

    console.log(`\n[*] Reparando contrato ${contractCode} (Airtable: ${record.id}) - ${contract ? 'Desasignado' : 'Faltante'}`);

    // 1. Resolve Client
    let cf: any = f;
    if (clientAirtableId && clientAirtableId.startsWith('rec')) {
        try {
            const cRec = await base('CLIENTES').find(clientAirtableId);
            cf = cRec.fields;
        } catch(e) {}
    }

    const businessName = (cf['Nombre completo Titular'] || f['Nombre completo Titular'] || cf['NOMBRERAZON SOCIAL'] || cf['Nombre completo'] || 'Desconocido').toString().trim();
    const rawCif = (cf['CIF']) ? (Array.isArray(cf['CIF']) ? cf['CIF'][0] : cf['CIF']) : null;
    const rawNif = cf['NIF Titular'] || cf['DNI/NIF Titular'] || cf['NIF'];
    let vatNumber = (rawCif || rawNif || `UNKNOWN_${record.id}`).toString().trim();

    let client = null;
    if (clientAirtableId && clientAirtableId.startsWith('rec')) client = await prisma.client.findUnique({ where: { airtableId: clientAirtableId } });
    if (!client) client = await prisma.client.findFirst({ where: { vatNumber } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          vatNumber, businessName, clientType: 'Física',
          contactEmail: cf['Email'] || f['EMAIL'] || 'test@test.com',
          contactPhone: cf['Teléfono'] || f['TLF'] || '000000000',
          brandId: brand.id, airtableId: clientAirtableId && clientAirtableId.startsWith('rec') ? clientAirtableId : null
        }
      });
      console.log(`    + Cliente creado: ${businessName}`);
    }

    // 2. Resolve Supply Point
    let sf: any = f;
    if (supplyAirtableId && supplyAirtableId.startsWith('rec')) {
        try {
            const sRec = await base('INSTALACIONES').find(supplyAirtableId);
            sf = sRec.fields;
        } catch(e) {}
    }

    const cups = (sf['CUPS'] || f['CUPS'] || `CUPS_${record.id}`).toString().trim();
    let supply = await prisma.supplyPoint.findFirst({ where: { cups, clientId: client.id } });
    if (!supply) {
      supply = await prisma.supplyPoint.create({
        data: {
          cups, clientId: client.id, airtableId: supplyAirtableId && supplyAirtableId.startsWith('rec') ? supplyAirtableId : null,
          address: (sf['DOMICILIO PS COMPLETO'] || 'Desconocida').toString(),
          city: (sf['Población Instalación'] || 'Desconocida').toString(),
          postalCode: (sf['Código Postal Instalación'] || '00000').toString(),
          province: (sf['Provincia Instalación'] || 'Desconocida').toString(),
          tariff: (sf['Tarifa'] || '2.0TD').toString(),
          annualConsumption: parseFloat(sf['CONSUMO ANUAL KWH']) || 0
        }
      });
      console.log(`    + SupplyPoint creado: ${cups} para cliente ${client.id}`);
    }

    // 3. Upsert Contract
    const status = (f['Estado'] || f['Estado CONTRATO'] || 'ACTIVO').toString().toUpperCase();
    let product = await prisma.product.findFirst({ where: { name: 'FIX' } });
    if (!product) product = await prisma.product.create({ data: { name: 'FIX', type: 'FIX', brandId: brand.id } });

    if (!contract) {
        await prisma.contract.create({
            data: {
                airtableId: record.id, contractCode, status, clientId: client.id, supplyPointId: supply.id,
                productId: product.id, userId: superAdmin.id,
                activationDate: parseDateSafe(f['ALTA COMERCIALIZADORA'])
            }
        });
        console.log(`    + Contrato creado exitosamente.`);
    } else {
        await prisma.contract.update({
            where: { id: contract.id },
            data: { clientId: client.id, supplyPointId: supply.id }
        });
        console.log(`    + Contrato corregido exitosamente.`);
    }
    
    fixedCount++;
  }

  console.log(`¡FINALIZADO! Se han reparado ${fixedCount} contratos.`);
}

run().finally(() => prisma.$disconnect());
