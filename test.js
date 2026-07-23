const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function run() { 
  const c = await prisma.contract.findFirst({ 
    where: { contractCode: 'PRJAV26210193FJ0F' },
    orderBy: { createdAt: 'desc' }
  }); 
  console.log(JSON.stringify({
    id: c.id,
    version: c.version,
    status: c.status,
    tipo: c.tipo,
    tipoC2: c.tipoC2,
    fechaAceptacion: c.fechaAceptacion,
    isSubrogation_json: c.airtableData?.isSubrogation,
    tipoC2_json: c.airtableData?.tipoC2
  }, null, 2)); 
  await prisma.$disconnect(); 
} 
run();
