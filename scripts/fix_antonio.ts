import Airtable from 'airtable';
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

async function check() {
    const r = await base('CONTRATOS').find('recoxRRHWL8tS3YVy');
    let f = r.fields as any;
    let clientAirtableId = f['CIF link'] ? f['CIF link'][0] : null;
    let supplyAirtableId = f['INSTALACIONES_LINK'] ? f['INSTALACIONES_LINK'][0] : null;

    let cf = (await base('CLIENTES').find(clientAirtableId)).fields as any;
    let sf = (await base('INSTALACIONES').find(supplyAirtableId)).fields as any;

    const vatNumber = (cf['CIF'] ? (Array.isArray(cf['CIF']) ? cf['CIF'][0] : cf['CIF']) : (cf['NIF Titular'] || cf['DNI/NIF Titular'] || cf['NIF'])).toString().trim();
    const businessName = (cf['Nombre completo Titular'] || cf['NOMBRERAZON SOCIAL'] || cf['Nombre completo']).toString().trim();
    
    let client = await prisma.client.findFirst({ where: { vatNumber } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          vatNumber, businessName, clientType: 'Física',
          contactEmail: cf['Email'] || 'test@test.com',
          contactPhone: cf['Teléfono'] || '000000000',
          brandId: 'cmq6j25l50001d441e0c06g9t', airtableId: clientAirtableId
        }
      });
      console.log(`Cliente creado: ${businessName}`);
    }

    const cups = (sf['CUPS'] || f['CUPS']).toString().trim();
    let supply = await prisma.supplyPoint.findFirst({ where: { cups, clientId: client.id } });
    if (!supply) {
      supply = await prisma.supplyPoint.create({
        data: {
          cups, clientId: client.id, airtableId: supplyAirtableId,
          address: (sf['DOMICILIO PS COMPLETO'] || 'Desconocida').toString(),
          city: (sf['Población Instalación'] || 'Desconocida').toString(),
          postalCode: (sf['Código Postal Instalación'] || '00000').toString(),
          province: (sf['Provincia Instalación'] || 'Desconocida').toString(),
          tariff: (sf['Tarifa'] || '2.0TD').toString(),
          annualConsumption: parseFloat(sf['CONSUMO ANUAL KWH']) || 0
        }
      });
      console.log(`SupplyPoint creado: ${cups}`);
    }

    await prisma.contract.update({
        where: { airtableId: 'recoxRRHWL8tS3YVy' },
        data: { clientId: client.id, supplyPointId: supply.id }
    });
    console.log(`Contrato corregido a ${businessName}`);
}

check().finally(() => prisma.$disconnect());
