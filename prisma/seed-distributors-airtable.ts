import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { prisma } from '../src/lib/prisma';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

async function syncDistributors() {
  console.log('Fetching distributors from Airtable...');
  const records = await base('DISTRIBUIDORAS').select({
    fields: ['NOMBRE DISTRI', 'Código', 'Registro CNMC', 'Portal', 'Tlfn']
  }).all();

  console.log(`Found ${records.length} distributors. Syncing to Prisma...`);

  let count = 0;
  for (const record of records) {
    const code = record.get('Código') as string;
    if (!code) continue; // Skip if no REE code

    const name = record.get('NOMBRE DISTRI') as string;
    const registroCnmc = record.get('Registro CNMC') as string;
    const portalUrl = record.get('Portal') as string;
    const phone = record.get('Tlfn') as string;

    await prisma.distributor.upsert({
      where: { reeCode: code },
      update: {
        name: name || '',
        registroCnmc: registroCnmc || null,
        portalUrl: portalUrl || null,
        phone: phone ? String(phone) : null,
      },
      create: {
        reeCode: code,
        name: name || '',
        registroCnmc: registroCnmc || null,
        portalUrl: portalUrl || null,
        phone: phone ? String(phone) : null,
      }
    });
    count++;
  }

  console.log(`Synced ${count} distributors successfully.`);
}

syncDistributors()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
