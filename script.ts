import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() { 
  const c = await prisma.contract.findMany({ 
    where: { contractCode: 'PRJAV26210193FJ0F' }, 
    select: { id: true, version: true, status: true, tipo: true, tipoC2: true, fechaAceptacion: true, airtableData: true } 
  }); 
  console.log(JSON.stringify(c.map((x: any) => ({
    version: x.version,
    status: x.status,
    tipo: x.tipo,
    tipoC2: x.tipoC2,
    fechaAceptacion: x.fechaAceptacion,
    isSubrogation_json: x.airtableData?.isSubrogation,
    tipoC2_json: x.airtableData?.tipoC2
  })), null, 2)); 
  await prisma.$disconnect(); 
} 
run();
