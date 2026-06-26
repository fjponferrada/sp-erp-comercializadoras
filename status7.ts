import { prisma } from './src/lib/prisma'; async function main() { const sp = await prisma.supplyPoint.findFirst({ select: { annualConsumption: true } }); console.log(sp); } main();
