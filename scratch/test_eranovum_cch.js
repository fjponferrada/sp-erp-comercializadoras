const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const f1Id = 'cmrahn7u2006u04k2rmcrmcgm';
    
    const f1 = await prisma.f1Invoice.findUnique({
      where: { id: f1Id },
      include: { 
        contract: { include: { product: true } }, 
        supplyPoint: true 
      }
    });

    console.log("F1 Start:", f1.fechaInicio, "F1 End:", f1.fechaFin);

    const loadCurves = await prisma.loadCurve.findMany({
      where: { cups: f1.supplyPoint.cups }
    });
    console.log("Total LoadCurves:", loadCurves.length);

    let totalCchMWh = 0;
    
    const startDate = new Date(f1.fechaInicio.getTime());
    const endDate = new Date(f1.fechaFin.getTime());
    endDate.setDate(endDate.getDate() + 1);

    for (const lc of loadCurves) {
      if (lc.isQuarterly && lc.valuesQuarter) {
        for (let q = 0; q < 96; q++) {
          const val = lc.valuesQuarter[q] || 0;
          const mwhQuarter = val / 1000.0;
          
          const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
          
          const h = Math.floor(q / 4);
          const qM = q % 4;
          const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(qM * 15).padStart(2, '0')}:00`;
          
          const hourDate = new Date(localStr + '+02:00'); // Assuming DST for June
          
          if (hourDate >= startDate && hourDate < endDate) {
            totalCchMWh += mwhQuarter;
          }
        }
      }
    }
    
    console.log("Calculated Total MWh:", totalCchMWh, "kWh:", totalCchMWh * 1000);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
