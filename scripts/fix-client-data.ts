import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log('Iniciando cirugía de datos faltantes en clientes...');
  
  // Buscar todos los clientes que puedan estar incompletos y tengan contratos
  const clients = await prisma.client.findMany({
    include: {
      contracts: true
    }
  });

  let fixed = 0;

  for (const client of clients) {
    // Si ya tiene IBAN y dirección y CNAE, podríamos omitirlo, pero mejor actualizar si falta algo.
    if (!client.iban || !client.billingAddress || !client.billingCity) {
      // Buscar el contrato más reciente que tenga airtableData
      const contract = client.contracts.find(c => c.airtableData && typeof c.airtableData === 'object');
      if (contract) {
        const f = contract.airtableData as any;

        const getVal = (key: string) => {
          const val = f[key];
          if (typeof val === 'string' && val.trim() === '') return undefined;
          return val;
        };

        const cnae = f['CNAE'] || f['SIPS Cnae'] || client.cnae;
        const iban = f['IBAN'] || f['Certificado IBAN'] || client.iban;
        const billingStreetType = getVal('Tipo de vía Titular') || client.billingStreetType;
        const billingStreet = getVal('Calle Titular') || client.billingStreet;
        const billingAddressAddition = getVal('Adicional Titular') || client.billingAddressAddition;
        
        let billingAddress = getVal('DOMICILIO SOC') || getVal('Domicilio Titular Completo') || client.billingAddress;
        let billingPostalCode = getVal('CP SOC') || client.billingPostalCode;
        let billingCity = getVal('POBLACION SOC') || client.billingCity;
        let billingProvince = getVal('PROVINCIA SOC') || client.billingProvince;

        // Fallbacks si en la tabla vienen distintos
        if (!billingAddress) {
          billingAddress = getVal('DOMICILIO PS COMPLETO'); // de la instalación, mejor que nada
        }

        const dataToUpdate: any = {};
        if (cnae && !client.cnae) dataToUpdate.cnae = cnae.toString().trim();
        if (iban && !client.iban) dataToUpdate.iban = iban.toString().trim();
        if (billingStreetType && !client.billingStreetType) dataToUpdate.billingStreetType = billingStreetType.toString().trim();
        if (billingStreet && !client.billingStreet) dataToUpdate.billingStreet = billingStreet.toString().trim();
        if (billingAddressAddition && !client.billingAddressAddition) dataToUpdate.billingAddressAddition = billingAddressAddition.toString().trim();
        if (billingAddress && !client.billingAddress) dataToUpdate.billingAddress = billingAddress.toString().trim();
        if (billingPostalCode && !client.billingPostalCode) dataToUpdate.billingPostalCode = billingPostalCode.toString().trim();
        if (billingCity && !client.billingCity) dataToUpdate.billingCity = billingCity.toString().trim();
        if (billingProvince && !client.billingProvince) dataToUpdate.billingProvince = billingProvince.toString().trim();

        if (Object.keys(dataToUpdate).length > 0) {
          await prisma.client.update({
            where: { id: client.id },
            data: dataToUpdate
          });
          fixed++;
          console.log(`Cliente ${client.businessName} actualizado:`, Object.keys(dataToUpdate));
        }
      }
    }
  }

  console.log(`\nCirugía completada. ${fixed} clientes actualizados con datos bancarios/dirección.`);
}

run().finally(() => process.exit(0));
