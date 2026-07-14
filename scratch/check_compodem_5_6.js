const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const d = new Date('2026-06-05T15:00:00Z');
    const comps = await prisma.systemComponentPrice.findMany({ where: { date: d } });
    comps.forEach(c => console.log(c.componentId + ': ' + c.price));
}
main().finally(() => prisma.$disconnect());
