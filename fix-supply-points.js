require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

function getAddressString(field) {
  if (!field) return '';
  if (typeof field === 'string') {
    if (field.startsWith('{')) {
      try {
        const obj = JSON.parse(field);
        return obj.address || obj.direccion || obj.fullAddress || '';
      } catch(e) {
        return field;
      }
    }
    return field;
  }
  if (typeof field === 'object') {
    return field.address || field.direccion || field.fullAddress || '';
  }
  return String(field);
}

function getSupplyAddress(cData) {
  if (!cData) return '';
  if (cData['DOMICILIO PS COMPLETO']) return String(cData['DOMICILIO PS COMPLETO']);
  if (cData['Domicilio Instalación Completo']) return String(cData['Domicilio Instalación Completo']);
  if (cData.sNombreVia) {
    const parts = [cData.sTipoVia, cData.sNombreVia, cData.sTipoNumeracion, cData.sNumero, cData.sAdicional].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  return getAddressString(cData.direccionSuministro);
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Find supply points with 'Pendiente' address
  const supplyPoints = await prisma.supplyPoint.findMany({
    where: { 
      OR: [
        { address: 'Pendiente' },
        { address: 'PENDIENTE' },
        { city: 'Pendiente' },
        { postalCode: '00000' }
      ]
    },
    include: {
      contracts: {
        include: {
          Lead: true
        }
      }
    }
  });

  console.log(`Found ${supplyPoints.length} supply points to fix.`);

  let fixedCount = 0;
  for (const sp of supplyPoints) {
    let cData = null;
    if (sp.contracts && sp.contracts.length > 0 && sp.contracts[0].Lead) {
      const lead = sp.contracts[0].Lead;
      cData = lead.contractData || lead.airtableData;
    }

    if (cData) {
      const newAddress = getSupplyAddress(cData);
      const newCity = cData.sPoblacion || cData.poblacion || cData['Población Instalación'] || sp.city;
      const newPostalCode = cData.sCp || cData.cp || cData['Código Postal Instalación'] || sp.postalCode;
      const newProvince = cData.sProvincia || cData.provincia || cData['Provincia Instalación'] || sp.province;

      if (newAddress && newAddress !== 'Pendiente' && newAddress !== '') {
        await prisma.supplyPoint.update({
          where: { id: sp.id },
          data: {
            address: newAddress,
            city: newCity,
            postalCode: newPostalCode,
            province: newProvince
          }
        });
        fixedCount++;
        console.log(`Fixed SP ${sp.id}: ${newAddress}, ${newPostalCode} ${newCity} (${newProvince})`);
      }
    }
  }

  console.log(`Fixed ${fixedCount} supply points.`);
  await prisma.$disconnect();
}

main().catch(console.error);
