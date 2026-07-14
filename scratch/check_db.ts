import { prisma } from '../src/lib/prisma';
async function main() {
    const d = new Date('2026-06-05T15:00:00Z');
    const comps = await prisma.systemComponentPrice.findMany({ where: { date: d } });
    comps.forEach(c => console.log(c.componentId + ': ' + c.price.toString()));
}
main().finally(() => prisma.$disconnect());
