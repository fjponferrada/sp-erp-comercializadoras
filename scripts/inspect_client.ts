import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const sp = await prisma.supplyPoint.findFirst({
        where: { cups: 'ES0031101402139001ZV0F' },
        include: { client: true }
    });
    console.log(JSON.stringify(sp?.client, null, 2));
}
main().finally(() => prisma.$disconnect());
