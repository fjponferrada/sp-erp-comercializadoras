const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const f1s = await prisma.f1Invoice.findMany({
    where: {
      supplyPoint: {
        cups: { startsWith: 'ES0031405446869086QD' }
      }
    },
    include: { supplyPoint: true }
  });

  for (const f of f1s) {
    const dGen = f.jsonData?.DatosGeneralesFacturaATR || {};
    const dFact = dGen.DatosFacturaATR || f.jsonData?.DatosFacturaATR || {};
    console.log('ID:', f.id);
    console.log('F1 JSON Periodo:', JSON.stringify(dFact.Periodo, null, 2));
    console.log('F1 DB FechaInicio:', f.fechaInicio);
    console.log('F1 DB FechaFin:', f.fechaFin);
    console.log('F1 Volume:', f.totalVolume);
  }
}

main().catch(console.error);
