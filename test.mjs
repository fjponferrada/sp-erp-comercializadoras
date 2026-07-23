import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() { 
  const c = await prisma.contract.findFirst({ 
    where: { contractCode: 'PRJAV26210193FJ0F' },
    orderBy: { createdAt: 'desc' }
  }); 
  console.log('--- CONTRACT DUMP ---');
  console.log('ID:', c.id);
  console.log('Status:', c.status);
  console.log('Tipo:', c.tipo);
  console.log('TipoC2:', c.tipoC2);
  console.log('AirtableData isSubrogation:', c.airtableData?.isSubrogation);
  console.log('AirtableData tipoC2:', c.airtableData?.tipoC2);
  await prisma.$disconnect(); 
} 
run();
