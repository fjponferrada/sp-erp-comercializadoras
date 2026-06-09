import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
// @ts-ignore
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error("Faltan credenciales de Airtable en .env");
  process.exit(1);
}

async function run() {
  console.log("Iniciando migración de Airtable (10 registros + Facturas)...");

  console.log("Limpiando base de datos primero...");
  await prisma.document.deleteMany({});
  await prisma.commission.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.contractModification.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.supplyPoint.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { notIn: ['fjponferrada@sp-energia.com', 'admin@migracion.com'] } } });
  
  async function fetchAllAirtableRecords(baseUrl: string) {
    let allRecords: any[] = [];
    let offset = '';
    do {
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}offset=${offset}`;
      const res = await fetch(url, { headers: { Authorization: "Bearer " + AIRTABLE_API_KEY } });
      if (!res.ok) break;
      const data = await res.json();
      if (data.records) allRecords.push(...data.records);
      offset = data.offset;
    } while (offset);
    return allRecords;
  }

  // Fetch 10 random contracts instead of the specific 5
  // Note: we fetch 100 and then pick 10 random to simulate "random" from Airtable
  const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/CONTRATOS?maxRecords=100&filterByFormula=" + encodeURIComponent('NOT({CUPS}="")');
  const response = await fetch(url, { headers: { Authorization: "Bearer " + AIRTABLE_API_KEY } });
  if (!response.ok) throw new Error("Error fetching Airtable: " + await response.text());

  const data = await response.json();
  // Shuffle and pick 10
  const shuffled = data.records.sort(() => 0.5 - Math.random());
  const records = shuffled.slice(0, 10);
  console.log("Obtenidos " + records.length + " contratos con facturas de Airtable.");

  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({ data: { name: 'AED Energía (Migrada)', cif: 'B00000000' } });
  }

  let brand = await prisma.brand.findFirst();
  if (!brand) {
    brand = await prisma.brand.create({ data: { name: 'AED Energía', slug: 'aed-energia', companyId: company.id } });
  }

  let admin = await prisma.user.findUnique({ where: { email: 'fjponferrada@sp-energia.com' } });
  if (!admin) {
    const adminHash = await bcrypt.hash('admin', 10);
    admin = await prisma.user.create({ data: { name: 'FJ Ponferrada', email: 'fjponferrada@sp-energia.com', password: adminHash, role: 'SUPERADMIN', brand: { connect: { id: brand.id } } } });
  }

  // Fetch Invoices later
  let allInvoices: any[] = [];

  console.log("Descargando CANALES de Airtable...");
  const canalesUrl = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/CANALES";
  const canales = await fetchAllAirtableRecords(canalesUrl);
  console.log(`Obtenidos ${canales.length} canales.`);

  // Map for SERVICIOS
  const serviciosMap: Record<string, string> = {
    "rec3giNSPTAHYZ6Ca": "Batería Virtual (5,99 €/mes)",
    "rec4ALZMphWAuIb40": "Gestión energía a precio de coste (3,90 €/mes)",
    "rec4m16hzWuPSCFC7": "Asesoramiento energético + Factura en papel (9,49 €/mes)",
    "recDNE5NjUQdbAOK5": "Asesoramiento energético (5,99 €/mes)",
    "recH9hgmpZsGugcdJ": "Asociar a Bolsillo solar (3,50 €/mes)",
    "recNbIOQwp6G0nheT": "Asesoramiento energético (4,99 €/factura)",
    "recQ2kTt4tTJLimlb": "Factura en papel (3,50 €/mes)",
    "recyJxb4cSWoRsM8b": "Alta Nueva (25 €/alta)"
  };

  const allProductsUrl = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/PRODUCTOS";
  const allProducts = await fetchAllAirtableRecords(allProductsUrl);
  console.log("Obtenidos " + allProducts.length + " productos de Airtable para poblar la BBDD.");

  console.log("Poblando Productos...");
  for (const prodRec of allProducts) {
    const p = prodRec.fields;
    const name = p['Nombre Producto'];
    if (!name) continue;
    const tariff = p['Tarifa'];
    const type = p['Tipo de producto'] || 'FIX';
    
    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : null;
    const p1e = parseNum(p['P1E']); const p2e = parseNum(p['P2E']); const p3e = parseNum(p['P3E']);
    const p4e = parseNum(p['P4E']); const p5e = parseNum(p['P5E']); const p6e = parseNum(p['P6E']);
    
    const p1p = parseNum(p['P1P']); const p2p = parseNum(p['P2P']); const p3p = parseNum(p['P3P']);
    const p4p = parseNum(p['P4P']); const p5p = parseNum(p['P5P']); const p6p = parseNum(p['P6P']);
    
    const fee = parseNum(p['Fee Index']);
    const feeExcedentes = parseNum(p['Fee Excedentes']);
    const pexc = parseNum(p['PExc']);
    const permanenceMonths = p['Meses permanencia'] ? parseInt(p['Meses permanencia'].toString()) : null;
    
    const cgBolsilloSolar = parseNum(p['CG Bolsillo Solar']);
    const hasSelfConsumption = p['¿Autoconsumo?'] === true || p['¿Autoconsumo?'] === 'true' || p['¿Autoconsumo?'] === 'Sí';
    const selfConsumptionType = p['Modalidad Autoconsumo'] ? p['Modalidad Autoconsumo'].toString().trim() : null;

    const safeTariff = tariff ? String(tariff).trim() : '';
    const commissionType = safeTariff === '2.0TD' ? 'POWER_TIERS' : 'MARGIN_PERCENTAGE';

    await prisma.product.create({
      data: { id: prodRec.id, name: name.toString().trim(), type: type.toString().trim(), brandId: brand.id, tariff: safeTariff, p1e, p2e, p3e, p4e, p5e, p6e, p1p, p2p, p3p, p4p, p5p, p6p, fee, feeExcedentes, pexc, permanenceMonths, commissionType, cgBolsilloSolar, hasSelfConsumption, selfConsumptionType, airtableData: p as any }
    });
  }
  console.log("Productos importados correctamente.");

  console.log("Insertando CANALES en BD y vinculando productos...");
  for (const c of canales) {
    const nombre = c.fields['Nombre'];
    if (!nombre) continue;
    
    const code = c.fields['Código Canal'] ? c.fields['Código Canal'].toString().trim() : c.id;
    const supervisorEmail = c.fields['Email Supervisor']?.toString().trim() || null;
    const adminEmail = c.fields['Email Administracion']?.toString().trim() || null;
    
    const validProductIds = new Set(allProducts.map(p => p.id));
    const productIds = c.fields['PRODUCTOS'] || [];
    const connectProducts = productIds
      .filter((id: string) => validProductIds.has(id))
      .map((id: string) => ({ id }));
    
    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
    const fixedCommissionPct = parseNum(c.fields['% Comisión Fijo']);
    const variableCommissionPct = parseNum(c.fields['% Comisión Variable']);
    const managerEmail = c.fields['Email Gerente']?.toString().trim() || null;
    const supportEmail = c.fields['Email AtCliente']?.toString().trim() || null;
    const autoGenerateContract = c.fields['GEN_CONTRATO_AUTO']?.toString().toUpperCase() === 'SI' || c.fields['GEN_CONTRATO_AUTO'] === true;
    const maxRenewalDays = c.fields['DIAS_RENOV_MAX'] ? parseInt(c.fields['DIAS_RENOV_MAX'].toString()) : 45;

    await prisma.channel.upsert({
      where: { id: c.id },
      update: { 
        code,
        name: nombre.toString(),
        supervisorEmail,
        adminEmail,
        managerEmail,
        supportEmail,
        fixedCommissionPct,
        variableCommissionPct,
        autoGenerateContract,
        maxRenewalDays,
        products: { set: [], connect: connectProducts } // Reset and connect
      },
      create: { 
        id: c.id, 
        code, 
        name: nombre.toString(),
        supervisorEmail,
        adminEmail,
        managerEmail,
        supportEmail,
        fixedCommissionPct,
        variableCommissionPct,
        autoGenerateContract,
        maxRenewalDays,
        products: { connect: connectProducts }
      }
    });
  }

  console.log("Descargando USUARIOS de Airtable...");
  const usuariosUrl = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/USUARIOS?filterByFormula=" + encodeURIComponent("NOT({CANALES LINK}='')");
  const usuarios = await fetchAllAirtableRecords(usuariosUrl);
  console.log(`Obtenidos ${usuarios.length} comerciales de Airtable.`);
  if (usuarios.length > 0) {
    for (const u of usuarios) {
      const f = u.fields;
      const rawEmail = f['Email'] || f['Email Link'];
      if (!rawEmail) continue;
      
      const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail.toString().trim();
      const name = f['Nombre2'] ? f['Nombre2'].toString().trim() : 'Sin Nombre';
      const codigo = f['Código'] ? f['Código'].toString().trim() : null;
      const phone = f['Teléfono'] ? f['Teléfono'].toString().trim() : null;
      
      const canalesLink = f['CANALES LINK'] || [];
      const assignedChannelCode = canalesLink.length > 0 ? canalesLink[0] : null;
      let channelId = null;
      if (assignedChannelCode) {
         const channel = await prisma.channel.findFirst({ where: { OR: [{ id: assignedChannelCode }, { code: assignedChannelCode }] } });
         if (channel) channelId = channel.id;
      }
      
      let isSupervisor = false;
      if (f['Supervisor canal'] === true) {
         isSupervisor = true;
      }

      const role = isSupervisor ? 'CANAL' : 'COMERCIAL';

      if (email !== 'fjponferrada@sp-energia.com') {
          const userHash = await bcrypt.hash('password123', 10);
          await prisma.user.upsert({
             where: { email },
             update: { name, codigo, phone, role, isChannelSupervisor: isSupervisor, channelId },
             create: { name, email, codigo, phone, role, isChannelSupervisor: isSupervisor, channelId, brandId: brand.id, password: userHash }
          });
      }
    }
  }

  // Recolectar IDs de facturas para los 10 contratos seleccionados
  const invoiceIdsToFetch = new Set<string>();
  for (const record of records) {
    const invIds = record.fields['FACTURAS'];
    if (Array.isArray(invIds)) {
      invIds.forEach((id: string) => invoiceIdsToFetch.add(id));
    }
  }

  // Descargar facturas asociadas en lotes (Airtable max URL length restriction)
  if (invoiceIdsToFetch.size > 0) {
    const idsArray = Array.from(invoiceIdsToFetch);
    console.log(`Descargando ${idsArray.length} facturas vinculadas a los contratos...`);
    for (let i = 0; i < idsArray.length; i += 50) {
      const batch = idsArray.slice(i, i + 50);
      const formula = "OR(" + batch.map(id => `RECORD_ID()='${id}'`).join(",") + ")";
      const invUrl = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/FACTURAS?filterByFormula=" + encodeURIComponent(formula);
      const res = await fetch(invUrl, { headers: { Authorization: "Bearer " + AIRTABLE_API_KEY } });
      if (res.ok) {
        const data = await res.json();
        if (data.records) allInvoices.push(...data.records);
      }
    }
    console.log(`Descargadas ${allInvoices.length} facturas correctamente.`);
  }

  for (const record of records) {
    const f = record.fields;
    console.log(`\nProcesando Contrato Airtable ID: ${record.id}`);

    try {
      // Mapeo Cliente robusto
      const rawVat = f['NIF Contacto'] || f['Copia de CIF link'] || f['CONTROLSAGE']?.substring(1, 10);
      const vatNumber = rawVat ? rawVat.toString().trim() : 'UNKNOWN';
      
      const getVal = (key: string) => {
        const val = f[key];
        if (typeof val === 'string' && val.trim() === '') return undefined;
        return val;
      };

      // PRIORIZAR RAZON SOCIAL para B2B/Empresas en lugar de Nombre y Apellidos (Apoderado)
      let businessName = getVal('NOMBRE/RAZON SOCIAL') || getVal('NOMBRERAZON SOCIAL') || 'Cliente Desconocido';
      
      const primerApellido = getVal('Primer Apellido');
      if (primerApellido) {
          // Es persona física, usar NOMBRE Y APELLIDOS completo
          businessName = getVal('NOMBRE Y APELLIDOS') || getVal('Nombre completo Titular') || `${businessName} ${primerApellido} ${getVal('Segundo Apellido') || ''}`.trim();
      } else if (businessName === 'Cliente Desconocido') {
          businessName = getVal('NOMBRE Y APELLIDOS') || getVal('Nombre completo Titular') || 'Cliente Desconocido';
      }
      
      const rawEmail = f['EMAIL'] || f['Email Contacto'] || f['EMAIL FACTURA'] || f['EMAIL_4'];
      const email = Array.isArray(rawEmail) ? rawEmail[0] : (rawEmail || `noemail_${record.id}@temp.com`);
      
      const rawPhone = f['TLF'] || f['Telefono Contacto'] || f['TLF_2'] || f['TLF_3'];
      const phone = Array.isArray(rawPhone) ? rawPhone[0] : (rawPhone ? rawPhone.toString() : null);
      
      const address = f['DOMICILIO SOC'] || f['Domicilio Titular Completo'];

      // Extract CNAE and IBAN early
      const cnae = f['CNAE'] || f['SIPS Cnae'] || null;
      const iban = f['IBAN'] || f['Certificado IBAN'] || null;

        const contactName = getVal('Nombre Contacto') ? getVal('Nombre Contacto').toString().trim() : null;
        const contactLastName = getVal('Apellidos Contacto') ? getVal('Apellidos Contacto').toString().trim() : null;
        const repName = contactName ? (contactName + (contactLastName ? ' ' + contactLastName : '')) : null;

        const clientData = {
          businessName, 
          firstName: getVal('Primer Apellido') ? getVal('Primer Apellido').toString().trim() : null, 
          lastName: getVal('Segundo Apellido') ? getVal('Segundo Apellido').toString().trim() : null,
          clientType: getVal('Tipo_de_cliente') ? getVal('Tipo_de_cliente').toString().trim().toUpperCase() : (getVal('Tipo de persona') ? (getVal('Tipo de persona').toString().includes('rec') ? (getVal('Primer Apellido') ? 'F' : 'J') : getVal('Tipo de persona').toString().trim().toUpperCase()) : null),
          paperInvoice: getVal('¿Facturas papel?')?.toString().trim().toUpperCase() === 'SI',
          contactName,
          contactLastName,
          representativeName: repName,
          representativeVat: getVal('NIF Contacto') ? getVal('NIF Contacto').toString().trim() : null,
          representativeEmail: getVal('Email Contacto') ? getVal('Email Contacto').toString().trim() : null,
          representativePhone: getVal('Teléfono Contacto') ? getVal('Teléfono Contacto').toString().trim() : null,
          contactEmail: email, 
          contactPhone: phone, 
          contactPhone2: getVal('TLF_2') ? getVal('TLF_2').toString().trim() : null,
          contactPhone3: getVal('TLF_3') ? getVal('TLF_3').toString().trim() : null,
          cnae, 
          iban, 
          billingStreetType: getVal('Tipo de vía Titular') ? getVal('Tipo de vía Titular').toString().trim() : null,
          billingStreet: getVal('Calle Titular') ? getVal('Calle Titular').toString().trim() : null,
          billingAddressAddition: getVal('Adicional Titular') ? getVal('Adicional Titular').toString().trim() : null,
          billingAddress: getVal('DOMICILIO SOC') ? getVal('DOMICILIO SOC').toString().trim() : (getVal('Domicilio Titular Completo') ? getVal('Domicilio Titular Completo').toString().trim() : null),
          billingPostalCode: getVal('CP SOC') ? getVal('CP SOC').toString().trim() : null,
          billingCity: getVal('POBLACION SOC') ? getVal('POBLACION SOC').toString().trim() : null,
          billingProvince: getVal('PROVINCIA SOC') ? getVal('PROVINCIA SOC').toString().trim() : null,
          airtableData: f as any, 
          brand: { connect: { id: brand.id } }
        };

      let client = await prisma.client.findFirst({ where: { vatNumber } });
      if (!client && vatNumber !== 'UNKNOWN') {
        client = await prisma.client.create({ data: { ...clientData, vatNumber } });
      } else if (!client && vatNumber === 'UNKNOWN') {
        // Find by name if vatNumber is UNKNOWN
        client = await prisma.client.findFirst({ where: { businessName } });
        if (!client) {
            client = await prisma.client.create({ data: { ...clientData, vatNumber: `UNKNOWN_${Math.random().toString(36).substring(7)}` } });
        }
      }

      let rawCups = f['CUPS'];
      if (Array.isArray(rawCups)) rawCups = rawCups[0];
      const cups = (rawCups || (`CUPS_MOCK_${record.id}`)).toString().trim();
      const supplyAddress = f['DOMICILIO PS COMPLETO'] || 'Dirección Desconocida';
      const tariff = f['Tarifa'] || '2.0TD';
      
      // Extract consumptions: CONSUMO COMISION is in MWh (snapshot), CONSUMO ANUAL KWH is in kWh
      const consumoComision = parseFloat(f['CONSUMO COMISION']?.toString().replace(',', '.') || '0');
      const consumoAnualKwh = parseFloat(f['CONSUMO ANUAL KWH']?.toString().replace(',', '.') || '0') / 1000;
      const annualConsumption = consumoComision > 0 ? consumoComision : consumoAnualKwh;

      const parsePower = (val: any) => {
          if (!val) return null;
          return parseFloat(val.toString().replace(',', '.'));
      };
      const p1c = parsePower(f['P1C SIPS'] || f['P1C'] || f['P1']);
      const p2c = parsePower(f['P2C SIPS'] || f['P2C'] || f['P2']);
      const p3c = parsePower(f['P3C SIPS'] || f['P3C'] || f['P3']);
      const p4c = parsePower(f['P4C SIPS'] || f['P4C'] || f['P4']);
      const p5c = parsePower(f['P5C SIPS'] || f['P5C'] || f['P5']);
      const p6c = parsePower(f['P6C SIPS'] || f['P6C'] || f['P6']);

      let supplyPoint = await prisma.supplyPoint.findUnique({ where: { cups } });
      if (!supplyPoint) {
        if (cups) {
          const distName = Array.isArray(f['DISTRIBUIDORA']) ? f['DISTRIBUIDORA'][0] : (Array.isArray(f['Nombre Distribuidora']) ? f['Nombre Distribuidora'][0] : f['Nombre Distribuidora']);
          const distCode = f['CODIGO REE DISTRIBUIDORA'];
          const distributor = distName && distCode ? `[${distCode}] ${distName}` : (distName || distCode || null);
          
          const postalCode = getVal('Código Postal Instalación') ? getVal('Código Postal Instalación').toString().trim() : (getVal('CP_CONT') ? getVal('CP_CONT').toString().trim() : '00000');
          const city = getVal('Población Instalación') ? getVal('Población Instalación').toString().trim() : (getVal('POBLACION_CONT') ? getVal('POBLACION_CONT').toString().trim() : 'Desconocida');
          const province = getVal('Provincia Instalación') ? getVal('Provincia Instalación').toString().trim() : (getVal('PROVINCIA_CONT') ? getVal('PROVINCIA_CONT').toString().trim() : 'Desconocida');
          const streetType = getVal('Tipo de vía Instalación') ? getVal('Tipo de vía Instalación').toString().trim() : null;
          const street = getVal('Calle Instalación') ? getVal('Calle Instalación').toString().trim() : null;
          const addressAddition = getVal('Adicional Instalación') ? getVal('Adicional Instalación').toString().trim() : null;

          supplyPoint = await prisma.supplyPoint.create({ 
            data: { 
              cups, address: supplyAddress, postalCode, city, province, streetType, street, addressAddition,
              tariff, annualConsumption, cnae, p1c, p2c, p3c, p4c, p5c, p6c, distributor,
              clientId: client!.id, airtableData: f as any 
            } 
          });
        }
      }

        const rawProductName = Array.isArray(f['Producto y Servicio']) ? f['Producto y Servicio'][0] : (f['Producto y Servicio'] || 'Producto Migrado');
        const productName = String(rawProductName).trim();
        const productTypeLiteral = f['Tipo de producto'] ? String(f['Tipo de producto']).trim() : 'Fijo';
  
        let product = await prisma.product.findFirst({ where: { name: productName } });
        if (!product) {
          const contractTariff = f['Tarifa'] ? String(f['Tarifa']).trim() : null;
          const dummyCommissionType = contractTariff === '2.0TD' ? 'POWER_TIERS' : 'MARGIN_PERCENTAGE';
          product = await prisma.product.create({ data: { name: productName, type: productTypeLiteral, brandId: brand.id, tariff: contractTariff, commissionType: dummyCommissionType } });
        } else {
        // Actualizar tipo por si era un FIX anterior erróneo
        await prisma.product.update({ where: { id: product.id }, data: { type: productTypeLiteral } });
      }

      const airtableId = record.id;
      let existingContract = await prisma.contract.findUnique({ where: { airtableId } });

      let contract;
      let status = 'TRAMITANDO';
      const airtableStatus = f['Estado'];
      if (airtableStatus) {
        const sUpper = airtableStatus.toString().toUpperCase();
        if (sUpper.includes('ACTIVO')) status = 'ACTIVO';
        else if (sUpper.includes('BAJA')) status = 'BAJA';
        else if (sUpper.includes('BORRADOR')) status = 'BORRADOR';
        else if (sUpper.includes('RECHAZA')) status = 'RECHAZADO';
        else if (sUpper.includes('ACEPTAD')) status = 'ACEPTADO';
        else if (sUpper.includes('FINALIZ')) status = 'FINALIZADO';
      }

      // Determinar canal y comercial
      let assignedChannelId = null;
      const rawCanal = f['CANAL'];
      if (rawCanal && Array.isArray(rawCanal) && rawCanal.length > 0) {
        const canalRecordId = rawCanal[0];
        const channel = await prisma.channel.findUnique({ where: { code: canalRecordId } });
        if (channel) assignedChannelId = channel.id;
      }

      let assignedUserId = admin.id;
      const rawEmailComercial = f['Email Comercial'];
      if (rawEmailComercial && Array.isArray(rawEmailComercial) && rawEmailComercial.length > 0) {
          const emailComercial = rawEmailComercial[0];
          const foundUser = await prisma.user.findUnique({ where: { email: emailComercial } });
          if (foundUser) {
              assignedUserId = foundUser.id;
              // Link user to channel if not already linked
              if (assignedChannelId && !foundUser.channelId) {
                  await prisma.user.update({ where: { id: foundUser.id }, data: { channelId: assignedChannelId }});
              }
          } else {
              console.log(`  [WARN] Comercial no encontrado: ${emailComercial}`);
          }
      }

      if (!existingContract) {
        const activationDate = f['ALTA COMERCIALIZADORA'] ? new Date(f['ALTA COMERCIALIZADORA']) : null;
        const permanenceStartDate = f['INICIO_PERMANENCIA'] ? new Date(f['INICIO_PERMANENCIA']) : activationDate;
        const createdAt = f['Fecha Registro'] ? new Date(f['Fecha Registro']) : new Date();

        const tramitationRaw = f['Tramitación a realizar'] || f['Tipo'];
        const tramitationType = tramitationRaw ? (Array.isArray(tramitationRaw) ? tramitationRaw[0].toString() : tramitationRaw.toString()) : null;

        const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : null;

        let svaId = Array.isArray(f['Servicio']) ? f['Servicio'][0] : (f['Servicio'] ? String(f['Servicio']) : null);
        let svaConceptName = svaId ? (serviciosMap[svaId] || svaId) : null;

        contract = await prisma.contract.create({
          data: {
            status,
            contractCode: f['CONTRATO'] || null,
            tramitationType,
            signatureDate: f['Fecha firma contrato'] ? new Date(f['Fecha firma contrato']) : null,
            activationDate,
            permanenceStartDate,
            terminationDate: f['BAJA COMERCIALIZADORA'] ? new Date(f['BAJA COMERCIALIZADORA']) : null,
            p1e: parseNum(f['P1E (from PRODUCTOS)']),
            p2e: parseNum(f['P2E (from PRODUCTOS)']),
            p3e: parseNum(f['P3E (from PRODUCTOS)']),
            p4e: parseNum(f['P4E (from PRODUCTOS)']),
            p5e: parseNum(f['P5E (from PRODUCTOS)']),
            p6e: parseNum(f['P6E (from PRODUCTOS)']),
            p1p: parseNum(f['P1P'] || f['P1P (from PRODUCTOS)']),
            p2p: parseNum(f['P2P'] || f['P2P (from PRODUCTOS)']),
            p3p: parseNum(f['P3P'] || f['P3P (from PRODUCTOS)']),
            p4p: parseNum(f['P4P'] || f['P4P (from PRODUCTOS)']),
            p5p: parseNum(f['P5P'] || f['P5P (from PRODUCTOS)']),
            p6p: parseNum(f['P6P'] || f['P6P (from PRODUCTOS)']),
            fee: parseNum(f['Fee Index (from PRODUCTOS)']),
            pexc: parseNum(f['PExc (from PRODUCTOS)']),
            deviationCost: parseNum(f['DSV Index (from PRODUCTOS)']),
            svaConcept: svaConceptName,
            svaPrice: parseNum(f['Precio (from SERVICIOS)']),
            svaDuration: f['DURACION SVA'] ? parseInt(f['DURACION SVA'].toString()) : null,
            svaStartDate: f['FECHA INICIO SVA'] ? new Date(f['FECHA INICIO SVA']) : null,
            clientId: client!.id, supplyPointId: supplyPoint!.id, productId: product.id, userId: assignedUserId, airtableId, airtableData: f as any,
            createdAt
          }
        });

        await prisma.lead.create({
          data: {
            businessName, vatNumber, email, phone, status, source: Array.isArray(f['CANAL']) ? f['CANAL'][0] : (f['CANAL'] || 'Migración Airtable'), cups, estimatedMWh: annualConsumption, tariff, userId: assignedUserId, contractId: contract.id, airtableId, airtableData: f as any,
            createdAt
          }
        });
        console.log(`  + Creado Contrato/Lead OK. Estado: ${status}`);
      } else {
        contract = existingContract;
        console.log(`  -> Contrato ${airtableId} ya existía.`);
      }

      // -- IMPORTAR FACTURAS (filtrando del global) --
      const invoices = allInvoices.filter(inv => {
        const c2 = inv.fields['Contrato2'];
        return Array.isArray(c2) && c2.includes(airtableId);
      });
      console.log(`  + Encontradas ${invoices.length} facturas asociadas localmente.`);
      
      for (const inv of invoices) {
        const invFields = inv.fields;
        const invoiceNumber = invFields['Numero Factura'] || invFields['N Factura'] || `INV_MOCK_${inv.id}`;
        
        let existingInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber } });
        if (!existingInvoice) {
          const issueDate = invFields['Fecha Factura'] ? new Date(invFields['Fecha Factura']) : new Date();
          const totalAmount = parseFloat(invFields['Total']) || 0;
          const subtotal1 = parseFloat(invFields['Subtotal 1']) || 0;
          
          const billingStart = invFields['Desde'] ? new Date(invFields['Desde']) : null;
          const billingEnd = invFields['Hasta'] ? new Date(invFields['Hasta']) : (invFields['Hasta(EA)'] ? new Date(invFields['Hasta(EA)']) : null);
          const totalMWh = parseFloat(invFields['Cantidad Energía Total Consumida CORR'] || invFields['Consumo'] || 0);
          const origin = invFields['Procedencia Desde'] ? String(invFields['Procedencia Desde']) : null;

          const pdfs = invFields['PDF'];
          let pdfUrl = null;
          if (pdfs && Array.isArray(pdfs) && pdfs.length > 0) {
            pdfUrl = pdfs[0].url;
          }

          await prisma.invoice.create({
            data: {
              invoiceNumber,
              invoiceType: invFields['Tipo Factura'] || 'Normal',
              clientId: client!.id,
              contractId: contract.id,
              supplyPointId: supplyPoint!.id,
              issueDate,
              totalAmount,
              subtotal1,
              totalMWh,
              billingStart,
              billingEnd,
              desde: invFields['Desde'] ? String(invFields['Desde']) : null,
              hasta: invFields['Hasta'] ? String(invFields['Hasta']) : null,
              desdeEA: invFields['Desde(EA)'] ? String(invFields['Desde(EA)']) : null,
              hastaEA: invFields['Hasta(EA)'] ? String(invFields['Hasta(EA)']) : null,
              origin,
              pdfUrl,
              invoiceData: invFields as any
            }
          });
          console.log(`    - Importada factura: ${invoiceNumber}`);
        } else {
          await prisma.invoice.update({
            where: { id: existingInvoice.id },
            data: { invoiceData: invFields as any }
          });
          console.log(`    - Factura ${invoiceNumber} actualizada con invoiceData.`);
        }
      }

    } catch (e: any) {
      console.error(`  [ERROR] Procesando registro ${record.id}: `, e.message);
    }
  }

  console.log(`\n¡Migración finalizada con éxito!`);
}

run().catch(e => { console.error("Error fatal:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
