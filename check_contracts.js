const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const gw = await prisma.contract.findFirst({ where: { contractCode: 'PRPR263111310GW0F' } });
    console.log('PRPR263111310GW0F (missing in ERP):', gw ? {
        act: gw.activationDate,
        term: gw.terminationDate,
        status: gw.status
    } : 'NOT FOUND');

    const xv = await prisma.contract.findFirst({ where: { contractCode: 'PRPR263242053XV0F' } });
    console.log('PRPR263242053XV0F (missing in Excel):', xv ? {
        act: xv.activationDate,
        term: xv.terminationDate,
        status: xv.status
    } : 'NOT FOUND');
}

run().catch(console.error).finally(() => prisma.$disconnect());
