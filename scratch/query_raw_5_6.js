const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const d = new Date('2026-06-05T15:00:00Z');
    const comps = await prisma.$queryRaw`SELECT component, "values"[1] as v1, "values"[2] as v2, "values"[3] as v3, "values"[4] as v4 FROM "SystemComponentPrice" WHERE date = ${d};`;
    console.log(comps);
}
main().finally(() => prisma.$disconnect());
