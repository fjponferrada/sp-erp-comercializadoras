import { prisma } from './src/lib/prisma'; async function main() { const c = await prisma.aggregatedLoadCurve.findMany({ select: { date: true }, take: 10 }); console.log(c); } main();
