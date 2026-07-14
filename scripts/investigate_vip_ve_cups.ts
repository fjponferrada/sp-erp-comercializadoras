import { prisma } from '../src/lib/prisma';

async function main() {
  const vipCups = [
    'ES0031101402503003QK0F', 'ES0031104456078001MY0F', 'ES0031104456078002MF0F',
    'ES0031104938450001NK0F', 'ES0031105360168001RA0F', 'ES0031101348602003BG0F',
    'ES0031104938454001WL0F', 'ES0031104116766001SZ0F', 'ES0294000000002863NS0F',
    'ES0021000001740730SH', 'ES0031102341270001NP0F', 'ES0031101498164002PH0F',
    'ES0031101741527001LV0F', 'ES0031105131691001XN0F', 'ES0031104831144001SS0F',
    'ES0031103552270001BY0F', 'ES0031101351879001GP0F', 'ES0022000007201193AH1P',
    'ES0031105444408001CL0F', 'ES0031101504203002YT0F', 'ES0031104614744001ET0F',
    'ES0031105510932001AS0F', 'ES0031101490526002HL0F', 'ES0031104242860001ZX0F',
    'ES0031104883633001VW0F', 'ES0031101952607001CR0F', 'ES0021000021013512AL'
  ];

  const points = await prisma.supplyPoint.findMany({
    where: { cups: { in: vipCups } },
    select: { cups: true, annualConsumption: true, segment: true, tariff: true }
  });

  console.log("VIP Check:");
  console.table(points);

  const vePoints = await prisma.supplyPoint.findMany({
    where: { segment: 'VE >15 MWh' },
    select: { cups: true, annualConsumption: true, segment: true, tariff: true }
  });

  console.log("\nVE >15 MWh Points:");
  console.table(vePoints);
  
  const summary = await prisma.supplyPoint.groupBy({
    by: ['segment'],
    _count: { segment: true }
  });
  console.log("\nFull Segment Summary:");
  console.log(summary);
}

main().finally(() => prisma.$disconnect());
