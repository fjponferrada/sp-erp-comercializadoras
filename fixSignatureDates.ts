import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Starting signatureDate fix script...');
  
  // Find all contracts with version > 0 and signatureDate === null
  const contractsToFix = await prisma.contract.findMany({
    where: {
      version: { gt: 0 },
      signatureDate: null
    }
  });
  
  console.log(`Found ${contractsToFix.length} contracts to fix.`);
  
  let fixedCount = 0;
  
  for (const contract of contractsToFix) {
    // Find version 0 of the same contractCode
    const version0 = await prisma.contract.findFirst({
      where: {
        contractCode: contract.contractCode,
        version: 0
      }
    });
    
    if (version0 && version0.signatureDate) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { signatureDate: version0.signatureDate }
      });
      console.log(`Fixed contract ${contract.contractCode} (version ${contract.version}) -> Set signatureDate to ${version0.signatureDate}`);
      fixedCount++;
    } else {
      console.log(`Skipped contract ${contract.contractCode} (version ${contract.version}) -> Version 0 not found or has no signatureDate`);
    }
  }
  
  console.log(`Finished! Successfully fixed ${fixedCount} contracts.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
