import { prisma } from './src/lib/prisma';

async function main() {
  const code = 'NUEB26222146HT0F';
  const contracts = await prisma.contract.findMany({
    where: { contractCode: code },
    orderBy: { version: 'asc' },
    include: {
      supplyPoint: true,
      product: true,
    }
  });

  console.log(`Found ${contracts.length} versions for contract ${code}`);
  for (const c of contracts) {
    console.log(`Version: ${c.version}, Status: ${c.status}, CreatedAt: ${c.createdAt}, UpdatedAt: ${c.updatedAt}, UserId: ${c.userId}`);
    console.log(`  ActivationDate: ${c.activationDate}, InternalComments: ${c.internalComments}`);
  }

  // Find any SwitchingEvents for this supply point that are M2
  if (contracts.length > 0) {
    const spId = contracts[0].supplyPointId;
    const events = await prisma.switchingEvent.findMany({
      where: { supplyPointId: spId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log(`\nFound latest 5 SwitchingEvents for this CUPS:`);
    for (const e of events) {
      console.log(`  Proceso: ${e.procesoBase}, Paso: ${e.paso}, Fecha: ${e.createdAt}, Error: ${e.hasError}, TipoError: ${e.tipoError}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
