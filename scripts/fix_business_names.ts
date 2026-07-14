import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting client businessName fix...");
    const clients = await prisma.client.findMany({
        where: { clientType: 'Persona física' }
    });

    let fixedCount = 0;
    for (const client of clients) {
        const expectedBusinessName = `${client.firstName || ''} ${client.lastName || ''}`.trim();
        if (client.businessName !== expectedBusinessName) {
            await prisma.client.update({
                where: { id: client.id },
                data: { businessName: expectedBusinessName }
            });
            fixedCount++;
        }
    }
    console.log(`Fixed businessName for ${fixedCount} clients.`);
}

main().finally(() => prisma.$disconnect());
