import { prisma } from './src/lib/prisma';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

async function main() {
  const contracts = await prisma.contract.findMany();
  console.log(`Found ${contracts.length} contracts in Prisma.`);
  
  for (const c of contracts) {
    if (!c.contractCode && c.airtableId) {
      try {
        const record = await base('CONTRATOS').find(c.airtableId);
        if (record && record.get('CONTRATO')) {
          await prisma.contract.update({
            where: { id: c.id },
            data: { contractCode: record.get('CONTRATO') as string }
          });
          console.log(`Updated contract ${c.id} with code ${record.get('CONTRATO')}`);
        }
      } catch (err) {
        console.log(`Could not fetch Airtable record for ${c.airtableId}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
