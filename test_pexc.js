const { prisma } = require('./src/lib/prisma');

async function run() {
  const c = await prisma.contract.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031105546451014LJ0F' } } }
  });
  console.log('Contract:', c?.pexc, c?.pricingModel);
  const f1 = await prisma.f1Invoice.findFirst({
    where: { supplyPoint: { cups: { contains: 'ES0031105546451014LJ0F' } } },
    orderBy: { createdAt: 'desc' }
  });
  
  const json = typeof f1.jsonData === 'string' ? JSON.parse(f1.jsonData) : f1.jsonData;
  
  console.log('Autoconsumo:', json?.Autoconsumo);
  console.log('EnergiaExcedentaria:', json?.EnergiaExcedentaria);
  console.log('Importe Excedentes Autoconsumo:', json['Importe Excedentes Autoconsumo']);
}

run().catch(console.error).finally(() => prisma.$disconnect());
