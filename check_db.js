const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findUnique({
    where: { contractCode: 'NUEB26392039DH0F' },
    include: { product: true }
  });
  console.log('Product for NUEB26392039DH0F:');
  console.log('ID:', c.product.id);
  console.log('Name:', c.product.name);
  console.log('CommissionType:', c.product.commissionType);
  
  const rules = await prisma.commissionRule.findMany({
    where: { tierId: 'cmqmnoucf00068441h382g88k' } // the tier from previous steps
  });
  console.log('\nRules for this tier:');
  rules.forEach(r => console.log(`- ${r.commissionType} | ${r.productType} | ${r.tariff} | ${r.powerMin}-${r.powerMax} | ${r.value}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
