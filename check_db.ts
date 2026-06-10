process.env.DATABASE_URL = "postgresql://postgres:SpEnergia2026%21@localhost:5432/sperp_local";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { contractCode: 'PRPR259181414SZ0F' },
    select: { version: true, p1p: true, p2p: true, p3p: true, p4p: true, p5p: true, p6p: true, supplyPointId: true }
  });
  console.log("Contracts:", JSON.stringify(contracts, null, 2));
  
  if (contracts.length > 0) {
    const supplyPoint = await prisma.supplyPoint.findUnique({
      where: { id: contracts[0].supplyPointId },
      select: { id: true, cups: true, p1c: true, p2c: true, p3c: true, p4c: true, p5c: true, p6c: true, p1p: true, p2p: true, p3p: true, p4p: true, p5p: true, p6p: true }
    });
    console.log("SupplyPoint:", JSON.stringify(supplyPoint, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
