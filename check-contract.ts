import { prisma } from './src/lib/prisma';

async function main() {
  const c1 = await prisma.contract.findFirst({
    where: { contractCode: 'PRPR26424941RG0F' }
  });
  const prev = await prisma.contract.findFirst({
    where: { id: c1?.previousContractId || '' }
  });

  console.log('c1:', c1?.status, 'prevId:', c1?.previousContractId);
  console.log('prev:', prev?.contractCode, 'expectedEndDate:', prev?.expectedEndDate);
}

main().catch(console.error).finally(() => process.exit(0));
