import { prisma } from './src/lib/prisma'; async function main() { const p = await prisma.portfolioBaseCurve.findMany({ take: 5, orderBy: { datetime: 'asc' } }); console.log(p); } main();
