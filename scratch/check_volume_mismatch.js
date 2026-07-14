const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const prisma = new PrismaClient();
  const cups = 'ES0031104495824004XP';
  
  // What is the startDate and endDate for this draft?
  const draft = await prisma.internalInvoice.findFirst({
    where: { contract: { supplyPoint: { cups: 'ES0031104495824004XP0F' } } },
    include: { f1Invoice: true }
  });
  
  if (!draft) return console.log("No draft found");
  
  console.log("f1Invoice.fechaInicio:", draft.f1Invoice.fechaInicio);
  console.log("f1Invoice.fechaFin:", draft.f1Invoice.fechaFin);
  
  const startDate = draft.f1Invoice.fechaInicio;
  const endDate = draft.f1Invoice.fechaFin;
  const actualEndDate = new Date(endDate.getTime() - 1000);

  const loadCurves = await prisma.loadCurve.findMany({
    where: {
      cups,
      date: {
        gte: new Date(startDate.getTime() - 24 * 3600 * 1000),
        lte: new Date(actualEndDate.getTime() + 24 * 3600 * 1000)
      }
    },
    orderBy: { date: 'asc' }
  });

  let totalMWh = 0;
  for (const lc of loadCurves) {
    if (lc.date < startDate || lc.date >= endDate) continue;
    let dayMWh = 0;
    for (const val of lc.readings) dayMWh += (val || 0) / 1000.0;
    totalMWh += dayMWh;
    console.log(`Included LC: ${lc.date.toISOString()}, MWh: ${dayMWh}`);
  }
  
  console.log(`Total MWh: ${totalMWh}`);
  console.log(`F1 Volume from DB: ${draft.repairData?.f1Volume || 'N/A'}`);
}

main().catch(console.error);
