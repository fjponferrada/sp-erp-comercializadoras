import { prisma } from '../src/lib/prisma';
async function main() {
    const d = new Date('2026-06-05T00:00:00Z');
    const comps = await prisma.systemComponentPrice.findMany({ where: { date: d } });
    comps.forEach(c => console.log(c.component + ': ' + c.values[16])); // Hour 17:00 is index 16
}
main().finally(() => prisma.$disconnect());
