import "dotenv/config";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const faultyContract = await prisma.contract.findFirst({
    where: { contractCode: { startsWith: 'ES0031104442493001QW0F' } }
  });

  if (!faultyContract) {
    console.log("No se encontró el contrato ES0031104442493001QW0F");
  }
  
  const allFaulty = await prisma.contract.findMany({
    where: { contractCode: { contains: '-V' } }
  });
  
  for (const c of allFaulty) {
    const correctCode = c.contractCode.split('-V')[0];
    const updated = await prisma.contract.update({
      where: { id: c.id },
      data: { contractCode: correctCode }
    });
    console.log(`Arreglado: ${c.contractCode} -> ${updated.contractCode}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
