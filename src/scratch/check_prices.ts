import { prisma } from '../lib/prisma';

async function main() {
  const os = await prisma.systemComponentPrice.findFirst({
    where: { component: 'OS', date: { gte: new Date('2026-07-01') } }
  });
  console.log('OS:', os?.values);

  const reganecu = await prisma.reganecuData.findFirst({
    where: { matricial: true, date: { gte: new Date('2026-07-01') } }
  });
  if (reganecu) {
    const jData = reganecu.jsonData as any[];
    console.log('Reganecu DSV sample:', jData.find(j => j.concept === 'DSV' || j.concept === 'DVS'));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
