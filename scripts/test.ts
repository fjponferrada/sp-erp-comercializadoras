import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
async function main() {
  const contracts = await prisma.contract.findMany({ include: { supplyPoint: true } });
  const mismatched = contracts.filter(c => c.clientId !== c.supplyPoint.clientId);
  console.log(`Mismatched contracts: ${mismatched.length}`);
}

main().finally(() => prisma.$disconnect());
