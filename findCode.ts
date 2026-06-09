import { prisma } from './src/lib/prisma';

async function main() {
  const leads = await prisma.lead.findMany({ take: 100 });
  for (const l of leads) {
    if (l.contractData) {
      console.log('Contract data exists for lead:', l.id);
    }
  }
  
  const contracts = await prisma.contract.findMany({ take: 100 });
  for (const c of contracts) {
    if (c.contractCode) {
      console.log('Contract code exists for contract:', c.id);
    }
  }
  console.log('Checked 100 leads and 100 contracts.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
