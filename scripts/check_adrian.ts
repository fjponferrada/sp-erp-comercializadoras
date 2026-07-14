import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const client = await prisma.client.findFirst({
        where: { vatNumber: '80164474K' }
    });
    console.log("DB Record for ADRIAN:", client);
}

main().finally(() => prisma.$disconnect());
