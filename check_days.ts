import { prisma } from './src/lib/prisma';

async function check() {
  const f1s = await prisma.f1Invoice.findMany({
    take: 5,
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
    const endDExclusive = new Date(f1.fechaFin.toISOString().split('T')[0] + 'T00:00:00Z');
    endDExclusive.setUTCDate(endDExclusive.getUTCDate() - 1);
    const newEndD = new Date(endDExclusive.toISOString().split('T')[0] + 'T23:59:59Z');

    let totalCchInclusive = 0;
    let totalCchExclusive = 0;
    let daysInclusive = 0;
    let daysExclusive = 0;
    for(const lc of lcs) {
        const val = lc.readings.reduce((a,b)=>a+b, 0);
        if(lc.date >= startD && lc.date <= endD) {
            totalCchInclusive += val;
            daysInclusive++;
        }
        if(lc.date >= startD && lc.date <= newEndD) {
            totalCchExclusive += val;
            daysExclusive++;
        }
    }
    
    // Calcula el total F1
    let totalF1 = 0;
    const pEnergia = typeof f1.jsonData === 'object' && f1.jsonData !== null && (f1.jsonData as any).Factura?.Peajes?.PeajeEnergia
      ? (f1.jsonData as any).Factura.Peajes.PeajeEnergia
      : [];
    const arrEnergia = Array.isArray(pEnergia) ? pEnergia : [pEnergia];
    for(const p of arrEnergia) {
      if(!p) continue;
      const v = p.ValorEnergiaActiva || p.valorEnergiaActiva || '0';
      totalF1 += parseFloat(v.toString().replace(',','.'))/1000.0;
    }

    if (totalCchInclusive > 0 || totalF1 > 0) {
      console.log(`\nClient: ${f1.contract?.client?.name || 'Unknown'}`);
      console.log(`F1 Start: ${startD.toISOString().split('T')[0]}, End: ${endD.toISOString().split('T')[0]}`);
      const expectedDays = Math.round((newEndD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`F1 volume: ${(totalF1 * 1000).toFixed(0)}`);
      console.log(`CCH exclusive: ${(totalCchExclusive).toFixed(0)} (Days found: ${daysExclusive}/${expectedDays})`);
    }
  }
}
check().finally(() => prisma.$disconnect());
