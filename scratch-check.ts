import { prisma } from './src/lib/prisma';

async function main() {
  const leads = await prisma.lead.findMany({
    where: { id: 'cmq6yyo4h0kitic41bvx1l0z2' },
  });
  if (leads.length > 0) {
    console.log('Lead found:', leads[0].id);
    console.log('contractData:', JSON.stringify(leads[0].contractData, null, 2));
    console.log('airtableData address keys:', Object.keys(leads[0].airtableData || {}).filter(k => k.toLowerCase().includes('instal') || k.toLowerCase().includes('ps') || k.toLowerCase().includes('dir')));
  } else {
    console.log('Lead not found.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
