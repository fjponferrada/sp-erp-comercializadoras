import { prisma } from './src/lib/prisma'; async function main() { const c = await prisma.portfolioBaseCurve.count(); console.log('Count:', c); } main();
