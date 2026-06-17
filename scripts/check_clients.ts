import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const clients = await prisma.client.findMany({
        where: { clientType: 'Física' },
        take: 10
    });
    for (const c of clients) {
        console.log(`${c.id}: ${c.firstName} | ${c.lastName}`);
    }
}
main().finally(() => prisma.$disconnect());
