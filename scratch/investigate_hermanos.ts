import { config } from 'dotenv';
config({ path: '.env.production' });
config({ path: '.env', override: false });

import { prisma } from '../src/lib/prisma';

async function main() {
  const nif = 'B56016454'; // HERMANOS MUÑOZ YEBENES
  console.log(`Buscando cliente con NIF ${nif}...`);

  const client = await prisma.client.findFirst({
    where: { vatNumber: { contains: nif } },
    include: {
      contracts: {
        include: { Lead: true }
      }
    }
  });

  if (!client) {
    console.log('Cliente no encontrado.');
    return;
  }

  console.log('--- CLIENTE ---');
  console.log(`Nombre: ${client.businessName || client.firstName}`);
  console.log(`Email contacto: ${client.contactEmail}`);
  console.log(`Email fra: ${client.invoiceEmail}`);
  console.log(`Teléfono 1: ${client.contactPhone}`);
  console.log(`Teléfono 2: ${client.contactPhone2}`);

  console.log('\n--- CONTRATOS ASOCIADOS ---');
  for (const c of client.contracts) {
    const aData = c.airtableData || {};
    const emails = [];
    const phones = [];
    
    // Check known email fields in Airtable
    if (aData['Email Fra']) emails.push(aData['Email Fra']);
    if (aData['Email']) emails.push(aData['Email']);
    if (aData['Email comercializadora antigua (desde PRODUCTOS)']) emails.push(aData['Email comercializadora antigua (desde PRODUCTOS)']);
    if (aData['eMAILFACTURA']) emails.push(aData['eMAILFACTURA']);
    if (aData['eMAIL4']) emails.push(aData['eMAIL4']);
    if (aData['eMAILCOMER']) emails.push(aData['eMAILCOMER']);

    // Check known phone fields
    if (aData['Teléfono Fra']) phones.push(aData['Teléfono Fra']);
    if (aData['Teléfono Titular']) phones.push(aData['Teléfono Titular']);
    if (aData['tELCONTACTO']) phones.push(aData['tELCONTACTO']);
    if (aData['tELFACTURA']) phones.push(aData['tELFACTURA']);

    // Check contact data (apoderado, etc)
    if (aData['contactoNif']) { /* Just noting it might be nested if it was JSON, but airtableData is flat */ }

    console.log(`Contrato ID: ${c.id} | Código: ${c.contractCode} | CUPS: ${c.supplyPointId}`);
    if (emails.length > 0) console.log(`  Emails en Airtable: ${[...new Set(emails)].join(', ')}`);
    if (phones.length > 0) console.log(`  Teléfonos en Airtable: ${[...new Set(phones)].join(', ')}`);
  }

  console.log('\n--- LEADS ASOCIADOS ---');
  for (const c of client.contracts) {
    if (c.Lead && c.Lead.length > 0) {
      for (const l of c.Lead) {
        console.log(`Lead ID: ${l.id} | Email: ${l.email} | Phone: ${l.phone}`);
        const aData = l.airtableData || {};
        const emails = [];
        if (aData['Email Fra']) emails.push(aData['Email Fra']);
        if (aData['Email']) emails.push(aData['Email']);
        if (emails.length > 0) console.log(`  Emails en Airtable del Lead: ${[...new Set(emails)].join(', ')}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
