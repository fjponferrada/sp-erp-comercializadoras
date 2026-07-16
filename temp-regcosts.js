const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const endDate = new Date('2026-02-01T00:00:00.000Z');
  const tariff = '3.0TD';
  
  const regCosts = await prisma.regulatedCost.findMany({
    where: {
      OR: [{ tariff }, { tariff: 'TODAS' }],
      validFrom: { lte: endDate },
      validTo: { gte: startDate }
    }
  });

  const peajes = regCosts.filter(r => r.concept === 'PEAJES_ENERGIA');
  const cargos = regCosts.filter(r => r.concept === 'CARGOS_ENERGIA');

  console.log("PEAJES:", peajes.map(p => ({ id: p.id, validFrom: p.validFrom, validTo: p.validTo, p1: p.p1 })));
  console.log("CARGOS:", cargos.map(c => ({ id: c.id, validFrom: c.validFrom, validTo: c.validTo, p1: c.p1 })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
