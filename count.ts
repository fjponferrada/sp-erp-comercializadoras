import { prisma } from './src/lib/prisma';
async function main() {
    const count = await prisma.switchingEvent.count({
        where: {
            procesoBase: 'T1',
            paso: '06',
            contractId: { not: null }
        }
    });
    console.log(`TOTAL_T1_06_MODIFIED: ${count}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());