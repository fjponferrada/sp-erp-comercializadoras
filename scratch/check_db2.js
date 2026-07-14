const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const d = new Date('2026-06-05T00:00:00Z');
    const comps = await prisma.systemComponentPrice.findMany({ where: { date: d } });
    comps.forEach(c => console.log(c.component + ': ' + c.values[16]));
}
main().finally(() => prisma.$disconnect());
