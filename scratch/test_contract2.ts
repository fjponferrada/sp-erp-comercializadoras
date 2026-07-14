import { prisma } from '../src/lib/prisma';

async function run() {
  const contract = await prisma.contract.findFirst({
    where: { supplyPoint: { cups: { startsWith: 'ES0031405446869086QD' } } }
  });
  console.log('Contract fee:', contract?.fee);
  console.log('Contract deviationCost:', contract?.deviationCost);
}
run();
