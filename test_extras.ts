import { prisma } from './src/lib/prisma';

async function main() {
  const years = [2025, 2026];
  const costs: any = {};
  
  for (const year of years) {
    const refDate = new Date(`${year}-07-14T00:00:00.000Z`);
    const refRegCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff: '3.0TD' }, { tariff: 'TODAS' }],
        validFrom: { lte: refDate },
        validTo: { gte: refDate }
      }
    });
    
    costs[year] = {
      fnee: refRegCosts.find(r => r.concept === 'FNEE'),
      pc: refRegCosts.find(r => r.concept === 'Pagos_Capacidad' || r.concept === 'PC' || r.concept === 'CAPACIDAD'),
      rom: refRegCosts.find(r => r.concept === 'ROM' || r.concept === 'Pago_OM'),
      ros: refRegCosts.find(r => r.concept === 'ROS' || r.concept === 'Pago_OS'),
    };
  }

  const fneeDiff = costs[2026].fnee.p1 - costs[2025].fnee.p1;

  for (const p of ['p3', 'p4', 'p6']) {
    const pc25 = costs[2025].pc?.[p] || 0;
    const pc26 = costs[2026].pc?.[p] || 0;
    const pcDiff = pc26 - pc25;
    
    const rom25 = costs[2025].rom?.[p] || 0;
    const rom26 = costs[2026].rom?.[p] || 0;
    const romDiff = rom26 - rom25;

    const ros25 = costs[2025].ros?.[p] || 0;
    const ros26 = costs[2026].ros?.[p] || 0;
    const rosDiff = ros26 - ros25;
    
    const totalDiff = fneeDiff + pcDiff + romDiff + rosDiff;
    
    console.log(`\n--- Periodo ${p.toUpperCase()} ---`);
    console.log(`FNEE Diff: +${fneeDiff.toFixed(6)}`);
    console.log(`PC Diff: ${pcDiff > 0 ? '+' : ''}${pcDiff.toFixed(6)}`);
    console.log(`ROM Diff: ${romDiff > 0 ? '+' : ''}${romDiff.toFixed(6)}`);
    console.log(`ROS Diff: ${rosDiff > 0 ? '+' : ''}${rosDiff.toFixed(6)}`);
    console.log(`Total Extra Diff (FNEE+PC+ROM+ROS): ${totalDiff > 0 ? '+' : ''}${totalDiff.toFixed(6)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
