import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { contractCode: 'PRPR26181358YA0F' },
    include: { supplyPoint: true, client: true }
  });
  console.log('Contract:', contract);
  if (contract?.supplyPoint) {
    console.log('Supply Point:', contract.supplyPoint);
  }
}
main();
