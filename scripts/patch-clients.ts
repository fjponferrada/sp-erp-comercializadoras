import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Iniciando parcheo de clientes para usar los datos del contrato más reciente...");

  const clients = await prisma.client.findMany({
    include: {
      contracts: {
        orderBy: { createdAt: 'desc' },
        where: { airtableData: { not: null } }
      }
    }
  });

  let updatedCount = 0;

  for (const client of clients) {
    if (client.contracts.length > 1) {
      const newestContract = client.contracts[0];
      const f = newestContract.airtableData as any;
      if (!f) continue;

      const getVal = (key: string) => {
        const val = f[key];
        if (typeof val === 'string' && val.trim() === '') return undefined;
        return val;
      };

      const rawEmail = f['EMAIL'] || f['Email Contacto'] || f['EMAIL FACTURA'] || f['EMAIL_4'];
      const email = Array.isArray(rawEmail) ? rawEmail[0] : (rawEmail || undefined);

      const rawPhone = f['TLF'] || f['Telefono Contacto'] || f['TLF_2'] || f['TLF_3'];
      const phone = Array.isArray(rawPhone) ? rawPhone[0] : (rawPhone ? String(rawPhone).trim() : undefined);

      const billingStreetType = getVal('Tipo de vía Titular') ? String(getVal('Tipo de vía Titular')).trim() : undefined;
      const billingStreet = getVal('Calle Titular') ? String(getVal('Calle Titular')).trim() : undefined;
      const billingAddressAddition = getVal('Adicional Titular') ? String(getVal('Adicional Titular')).trim() : undefined;
      
      const domicilioSoc = getVal('DOMICILIO SOC');
      const domicilioTitular = getVal('Domicilio Titular Completo');
      const billingAddress = domicilioSoc ? String(domicilioSoc).trim() : (domicilioTitular ? String(domicilioTitular).trim() : undefined);
      
      const billingPostalCode = getVal('CP SOC') ? String(getVal('CP SOC')).trim() : undefined;
      const billingCity = getVal('POBLACION SOC') ? String(getVal('POBLACION SOC')).trim() : undefined;
      const billingProvince = getVal('PROVINCIA SOC') ? String(getVal('PROVINCIA SOC')).trim() : undefined;

      const dataToUpdate: any = {};
      
      // Update only if truthy to avoid nullifying existing good data if the new contract was missing it
      if (email && !String(email).includes('@temp.com')) dataToUpdate.contactEmail = String(email).trim();
      if (phone) dataToUpdate.contactPhone = phone;
      if (billingStreetType) dataToUpdate.billingStreetType = billingStreetType;
      if (billingStreet) dataToUpdate.billingStreet = billingStreet;
      if (billingAddressAddition) dataToUpdate.billingAddressAddition = billingAddressAddition;
      if (billingAddress) dataToUpdate.billingAddress = billingAddress;
      if (billingPostalCode) dataToUpdate.billingPostalCode = billingPostalCode;
      if (billingCity) dataToUpdate.billingCity = billingCity;
      if (billingProvince) dataToUpdate.billingProvince = billingProvince;

      if (Object.keys(dataToUpdate).length > 0) {
        await prisma.client.update({
          where: { id: client.id },
          data: dataToUpdate
        });
        updatedCount++;
        console.log(`[OK] Cliente actualizado: ${client.businessName} (DNI/NIF: ${client.vatNumber}) -> Usando contrato de ${newestContract.createdAt.toISOString()}`);
      }
    }
  }

  console.log(`\n¡Completado! Se han actualizado los datos de contacto y domicilio de ${updatedCount} clientes con múltiples contratos.`);
  process.exit(0);
}

run().catch((e) => {
  console.error("Error ejecutando parche:", e);
  process.exit(1);
});
