import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Iniciando reparación de correos fantasma (Ghost Emails)...");

  // Get all clients with their contracts ordered by newest first
  const clients = await prisma.client.findMany({
    include: {
      contracts: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  let affectedCount = 0;
  let fixedCount = 0;

  for (const c of clients) {
    if (!c.contactEmail) continue;
    if (c.contracts.length === 0) continue; // Skip if no contracts

    let emailFound = false;
    for (const ct of c.contracts) {
      const f = ct.airtableData as any;
      if (!f) continue;
      const raw = f['EMAIL'] || f['Email Contacto'] || f['EMAIL FACTURA'] || f['EMAIL_4'];
      const email = Array.isArray(raw) ? raw[0] : raw;
      if (email === c.contactEmail) {
        emailFound = true;
        break;
      }
    }

    // If the email is not in any of the current contracts, it's a ghost email!
    if (!emailFound) {
      affectedCount++;
      const newestContract = c.contracts[0];
      const f = newestContract.airtableData as any;

      if (!f) {
        console.log(`[!] Cliente ${c.businessName} (NIF: ${c.vatNumber}) afectado, pero su contrato más reciente no tiene airtableData.`);
        continue;
      }

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
      
      if (email && !String(email).includes('@temp.com')) dataToUpdate.contactEmail = String(email).trim();
      else dataToUpdate.contactEmail = null; // Clear if no valid email

      if (phone) dataToUpdate.contactPhone = phone;
      if (billingStreetType) dataToUpdate.billingStreetType = billingStreetType;
      if (billingStreet) dataToUpdate.billingStreet = billingStreet;
      if (billingAddressAddition) dataToUpdate.billingAddressAddition = billingAddressAddition;
      if (billingAddress) dataToUpdate.billingAddress = billingAddress;
      if (billingPostalCode) dataToUpdate.billingPostalCode = billingPostalCode;
      if (billingCity) dataToUpdate.billingCity = billingCity;
      if (billingProvince) dataToUpdate.billingProvince = billingProvince;

      console.log(`\nReparando cliente: ${c.businessName} (${c.vatNumber})`);
      console.log(`  - Fantasma: ${c.contactEmail}`);
      console.log(`  + Nuevo Email: ${dataToUpdate.contactEmail || '(Vacío)'}`);

      await prisma.client.update({
        where: { id: c.id },
        data: dataToUpdate
      });

      fixedCount++;
    }
  }

  console.log(`\n¡Completado! Se han detectado ${affectedCount} clientes afectados, y se han reparado ${fixedCount} con éxito.`);
  process.exit(0);
}

run().catch((e) => {
  console.error("Error ejecutando parche:", e);
  process.exit(1);
});
