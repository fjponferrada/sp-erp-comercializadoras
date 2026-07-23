const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  const contract = await prisma.contract.findFirst({
    where: { contractCode: 'PRJAV26210193FJ0F', status: 'TRAMITANDO' }
  });
  console.log('Contract:', contract);

  if (!contract) return;
  const isSubrogacion = true; // Hardcoded for test
  console.log('fechaAceptacion:', contract.fechaAceptacion);
  console.log('!isSubrogacion:', !isSubrogacion);
  
  const events = await prisma.switchingEvent.findMany({
    where: { contractId: 'PRJAV26210193FJ0F' }
  });
  console.log('Events length:', events.length);
  process.exit(0);
}
run();
