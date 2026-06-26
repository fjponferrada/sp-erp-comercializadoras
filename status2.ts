import { prisma } from './src/lib/prisma'; async function main() { const c = await prisma.contract.groupBy({ by: ['status'], _count: true }); console.log(c); } main();
