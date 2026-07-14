import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const activeContracts = await prisma.contract.count({
    where: {
      status: 'ACTIVE',
      startDate: { lte: new Date('2025-08-31T23:59:59Z') },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date('2025-08-01T00:00:00Z') } }
      ]
    }
  });
  console.log(`Active contracts in August 2025: ${activeContracts}`);
  await prisma.$disconnect();
}
main();
