import { prisma } from './src/lib/prisma';

async function check() {
  const f1s = await prisma.f1Invoice.findMany({
    where: { contractId: { not: null }, supplyPointId: { not: null } },
    include: { supplyPoint: true, contract: { include: { client: true } } }
  });
  
  for(const f1 of f1s) {
    const baseCups = f1.supplyPoint.cups.substring(0, 20);
    const lcs = await prisma.loadCurve.findMany({
        where: { cups: { startsWith: baseCups } },
        orderBy: { date: 'asc' }
    });
    
    if(lcs.length === 0) continue;
    
    const startD = new Date(f1.fechaInicio.toISOString().split('T')[0] + 'T00:00:00Z');
    const endD = new Date(f1.fechaFin.toISOString().split('T')[0] + 'T23:59:59Z');
    
    let totalCch = 0;
    for(const lc of lcs) {
        if(lc.date >= startD && lc.date <= endD) {
            totalCch += lc.readings.reduce((a,b)=>a+b, 0);
        }
    }
    
    if (totalCch > 0) {
      console.log(`\nClient: ${f1.contract?.client?.name || 'Unknown'}`);
      console.log(`F1 Start: ${startD.toISOString().split('T')[0]}, End: ${endD.toISOString().split('T')[0]}`);
      console.log(`F1 BaseImponible/MWh: ${(f1.baseImponible||0)/100}`);
      console.log(`CCH volume (kWh): ${totalCch/1000}`);
    }
  }
}
check().finally(() => prisma.$disconnect());
