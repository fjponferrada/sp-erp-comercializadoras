import { prisma } from './src/lib/prisma'; async function main() { const f = await prisma.futurePrice.findUnique({ where: { month: 6 } }); console.log(f); } main();
