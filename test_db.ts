import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require"
    }
  }
});

async function main() {
  const baseCups = 'ES0031101445366001GN';
  console.log(`Buscando CUPS que empiecen por: ${baseCups}`);
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: { startsWith: baseCups } },
    include: { contracts: true }
  });
  
  if (sps.length === 0) {
    console.log("No se encontraron Supply Points.");
    return;
  }
  
  for (const sp of sps) {
    console.log(`SupplyPoint ID: ${sp.id}, CUPS: ${sp.cups}`);
    for (const c of sp.contracts) {
      console.log(`  Contract ID: ${c.id}, Status: '${c.status}', Code: ${c.contractCode}, reqDate: ${c.requestDate}`);
    }
  }

  // Check the switching events to see their current state
  const evs = await prisma.switchingEvent.findMany({
    where: { 
      supplyPoint: { cups: { startsWith: baseCups } }
    }
  });
  for (const e of evs) {
    console.log(`Event ID: ${e.id}, Paso: ${e.paso}, Proceso: ${e.procesoBase}, Warning: ${e.warning}, Resolved: ${e.isResolved}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
