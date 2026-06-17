import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    // Check Antonio Luque's CUPS
    const sp = await prisma.supplyPoint.findFirst({
        where: { cups: 'ES0031101402139001ZV0F' }
    });
    console.log("Antonio's SP:", sp);

    // Check how many have postalCode '00000'
    const zeroZips = await prisma.supplyPoint.count({
        where: { postalCode: '00000' }
    });
    console.log(`\nTotal SPs with '00000' postalCode: ${zeroZips}`);

    // Check weird CUPS
    const weirdCups = await prisma.supplyPoint.findMany({
        where: { cups: { startsWith: 'CUPS_' } },
        select: { cups: true }
    });
    console.log(`\nWeird CUPS:`, weirdCups);
}
main().finally(() => prisma.$disconnect());
