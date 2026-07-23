import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() { 
  const c = await prisma.contract.findFirst({ 
    where: { contractCode: 'PRJAV26210193FJ0F' },
    orderBy: { createdAt: 'desc' }
  }); 
  console.log(JSON.stringify(c?.airtableData, null, 2));
  await prisma.$disconnect(); 
} 
run();
