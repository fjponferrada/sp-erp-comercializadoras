import { prisma } from './src/lib/prisma';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

async function main() {
  console.log('Fetching CONTRATOS from Airtable...');
  
  const records = await base('CONTRATOS').select({ fields: ['CONTRATO'] }).all();
  console.log(`Fetched ${records.length} CONTRATOS records from Airtable.`);
  
  let updated = 0;
  
  const promises = records.map(async (record) => {
    const code = record.get('CONTRATO') as string;
    if (code) {
      await prisma.contract.updateMany({
        where: { airtableId: record.id },
        data: { contractCode: code }
      });
      updated++;
    }
  });

  const BATCH_SIZE = 50;
  for (let i = 0; i < promises.length; i += BATCH_SIZE) {
    await Promise.all(promises.slice(i, i + BATCH_SIZE));
    if (i % 1000 === 0) console.log(`Processed ${i} contracts...`);
  }
  console.log(`Updated ${updated} contracts in Prisma with their contractCode.`);
  
  console.log('Fetching LEADS from Airtable...');
  const leadRecords = await base('LEADS').select({ fields: ['CONTRATO'] }).all();
  console.log(`Fetched ${leadRecords.length} LEADS records from Airtable.`);
  let leadUpdated = 0;
  const leadPromises = leadRecords.map(async (record) => {
    const code = record.get('CONTRATO') as string;
    if (code) {
      await prisma.lead.updateMany({
        where: { airtableId: record.id },
        data: { contractData: { 'CONTRATO': code } }
      });
      leadUpdated++;
    }
  });

  for (let i = 0; i < leadPromises.length; i += BATCH_SIZE) {
    await Promise.all(leadPromises.slice(i, i + BATCH_SIZE));
    if (i % 1000 === 0) console.log(`Processed ${i} leads...`);
  }
  
  console.log(`Updated ${leadUpdated} leads in Prisma with their contractData.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
