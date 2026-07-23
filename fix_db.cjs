const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() { 
  const c = await prisma.contract.findFirst({ 
    where: { contractCode: 'PRJAV26210193FJ0F' },
    orderBy: { createdAt: 'desc' }
  }); 
  if (c) {
    await prisma.contract.update({
      where: { id: c.id },
      data: { tipoC2: 'S' }
    });
    console.log('Contract updated successfully with tipoC2 = S');
  } else {
    console.log('Contract not found');
  }
  await prisma.$disconnect(); 
} 
run();
