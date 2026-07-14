const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const prisma = new PrismaClient();
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;

async function fetchAirtable(table, maxRecords = null, filterFormula = null) {
  let records = [];
  let offset = null;
  let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?`;
  
  if (maxRecords) url += `&maxRecords=${maxRecords}`;
  if (filterFormula) url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;

  do {
    const fetchUrl = url + (offset ? `&offset=${offset}` : '');
    const res = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${API_KEY}` } });
    
    if (!res.ok) {
      if (res.status === 429) {
        console.log('Rate limit hit, waiting 2s...');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      console.error(`Error fetching ${table}:`, res.status, await res.text());
      break;
    }
    
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset;
    
    if (maxRecords && records.length >= maxRecords) break;
    await new Promise(r => setTimeout(r, 300)); // Small delay
  } while (offset);
  
  return records;
}

async function run() {
  console.log('1. Limpiando Base de Datos...');
  await prisma.invoice.deleteMany();
  await prisma.contractModification.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.supplyPoint.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany({ where: { email: { not: 'fjponferrada@sp-energia.com' } }});

  console.log('2. Configurando Cliente Cero (AED Energía)...');
  let company = await prisma.company.upsert({
    where: { codigo: 'AED' },
    update: {},
    create: {
      name: 'aed energía',
      cif: 'AED-CIF', // Placeholder
      codigo: 'AED'
    }
  });

  let brand = await prisma.brand.upsert({
    where: { codigoMarca: 'AED' },
    update: {},
    create: {
      name: 'aed energía',
      slug: 'aed-energia',
      codigoMarca: 'AED',
      companyId: company.id
    }
  });

  console.log('3. Extrayendo Productos, Canales y Usuarios Base...');
  const productosAT = await fetchAirtable('PRODUCTOS');
  const canalesAT = await fetchAirtable('CANALES');
  const usuariosAT = await fetchAirtable('USUARIOS');

  const productMap = {};
  for (const p of productosAT) {
    const f = p.fields;
    if (!f.Nombre) continue;
    const prod = await prisma.product.create({
      data: {
        name: f.Nombre,
        type: 'FIX',
        brandId: brand.id,
        p1e: f.P1E || 0, p2e: f.P2E || 0, p3e: f.P3E || 0,
        p4e: f.P4E || 0, p5e: f.P5E || 0, p6e: f.P6E || 0,
        p1p: f.P1P || 0, p2p: f.P2P || 0, p3p: f.P3P || 0,
        p4p: f.P4P || 0, p5p: f.P5P || 0, p6p: f.P6P || 0,
        fee: f.Fee || 0,
        pexc: f['Precio excedentes'] || 0
      }
    });
    productMap[p.id] = prod.id;
  }

  console.log('4. Extrayendo 200 Contratos de Airtable...');
  const contratosAT = await fetchAirtable('CONTRATOS', 200);

  // Recolectar IDs de leads y facturas
  const leadIds = new Set();
  const facturaIds = new Set();
  contratosAT.forEach(c => {
    if (c.fields.LEADS) c.fields.LEADS.forEach(id => leadIds.add(id));
    if (c.fields.FACTURAS) c.fields.FACTURAS.forEach(id => facturaIds.add(id));
  });

  console.log(`5. Extrayendo ${leadIds.size} Leads y ${facturaIds.size} Facturas vinculadas...`);
  // Haremos fetch de todo y lo uniremos (puede ser masivo, pero limitamos)
  // Como pueden ser muchos, los traeremos completos de Airtable (sin filtro, es mas facil)
  const leadsAT = await fetchAirtable('LEADS');
  const facturasAT = await fetchAirtable('FACTURAS');

  const leadsMapAT = {}; leadsAT.forEach(l => leadsMapAT[l.id] = l);
  const facturasMapAT = {}; facturasAT.forEach(f => facturasMapAT[f.id] = f);

  console.log('6. Transformando e Insertando Datos en Prisma...');
  for (const c of contratosAT) {
    const f = c.fields;
    
    // Crear o recuperar Cliente
    const vatNumber = f['NIF Titular'] || `NIF-TMP-${c.id}`;
    let client = await prisma.client.findUnique({ where: { vatNumber } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          vatNumber,
          businessName: f['Nombre / Razón social Titular'] || 'Desconocido',
          firstName: f['Primer apellido Titular'],
          lastName: f['Segundo apellido Titular'],
          brandId: brand.id,
          contactEmail: f['Email Contacto'],
          contactPhone: f['Teléfono Contacto'],
          iban: f['IBAN'],
          airtableId: c.id, // Guardamos temporal
          airtableData: f
        }
      });
    }

    // Crear Supply Point
    const cups = f['CUPS2'] || `CUPS-TMP-${c.id}`;
    let supplyPoint = await prisma.supplyPoint.findUnique({ where: { cups } });
    if (!supplyPoint) {
      supplyPoint = await prisma.supplyPoint.create({
        data: {
          cups,
          tariff: f['Tarifa'] || '2.0TD',
          address: f['Calle Instalación'] || 'Desconocida',
          city: f['Población Instalación'] || 'Desconocida',
          postalCode: f['Código Postal Instalación'] || '00000',
          province: f['Provincia Instalación'] || 'Desconocida',
          clientId: client.id,
          p1c: f['P1C W'] ? parseFloat(f['P1C W']) : 0,
          p2c: f['P2C W'] ? parseFloat(f['P2C W']) : 0,
          airtableData: f
        }
      });
    }

    // Identificar Comercial
    let userId = null; // Asignaremos el admin por defecto
    const superadmin = await prisma.user.findFirst();
    userId = superadmin.id;

    // Insertar Lead
    let leadObj = null;
    if (f.LEADS && f.LEADS.length > 0) {
      const l = leadsMapAT[f.LEADS[0]];
      if (l) {
        const lf = l.fields;
        leadObj = await prisma.lead.create({
          data: {
            businessName: lf['Nombre'] || client.businessName,
            vatNumber: client.vatNumber,
            email: lf['E-Mail'] || client.contactEmail,
            phone: lf['Teléfono'] || client.contactPhone,
            cups: cups,
            status: 'ENVIADO',
            userId: userId,
            airtableId: l.id,
            airtableData: lf
          }
        });
      }
    }

    if (!leadObj) {
      // Fallback
      leadObj = await prisma.lead.create({
        data: {
          businessName: client.businessName,
          vatNumber: client.vatNumber,
          cups: cups,
          status: 'ENVIADO',
          userId: userId,
          airtableId: `LEAD-TMP-${c.id}`,
          airtableData: f
        }
      });
    }

    // Identificar Producto
    let productId = null;
    if (f.ProductoLINK && f.ProductoLINK.length > 0) {
      productId = productMap[f.ProductoLINK[0]];
    }
    if (!productId && Object.keys(productMap).length > 0) {
      productId = Object.values(productMap)[0]; // Fallback
    }
    if (!productId) {
      const prod = await prisma.product.create({ data: { name: 'Producto Genérico', type: 'FIX', brandId: brand.id }});
      productMap['temp'] = prod.id;
      productId = prod.id;
    }

    // Insertar Contrato
    const contract = await prisma.contract.create({
      data: {
        status: f['Estado'] === 'Activo' ? 'ACTIVO' : (f['Estado'] === 'Finalizado' ? 'FINALIZADO' : 'TRAMITANDO'),
        contractCode: f['CONTRATO'],
        clientId: client.id,
        supplyPointId: supplyPoint.id,
        productId: productId,
        userId: userId,
        duration: f['DURACION'] ? parseInt(f['DURACION']) : 12,
        airtableId: c.id,
        airtableData: f,
        lead: {
          connect: { id: leadObj.id }
        }
      }
    });

    // Insertar Facturas
    if (f.FACTURAS) {
      for (const fid of f.FACTURAS) {
        const fact = facturasMapAT[fid];
        if (fact) {
          try {
             await prisma.invoice.create({
              data: {
                invoiceNumber: fact.fields['NUM FACTURA'] || `F-TMP-${fid}`,
                totalAmount: fact.fields['TOTAL'] || 0,
                totalMWh: fact.fields['TOTAL MWh'] || 0,
                clientId: client.id,
                contractId: contract.id,
                supplyPointId: supplyPoint.id,
                issueDate: fact.fields['FECHA EMISION'] ? new Date(fact.fields['FECHA EMISION']) : new Date(),
                airtableData: fact.fields
              }
            });
          } catch(e) {} // Ignorar duplicados o errores
        }
      }
    }
  }

  console.log('¡Migración completada con éxito!');
}

run().catch(console.error).finally(() => prisma.$disconnect());
