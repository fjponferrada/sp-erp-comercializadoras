import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const clients = await prisma.client.findMany({
        where: { clientType: 'Física' }
    });
    console.log(`Found ${clients.length} clients with clientType Física.`);
    
    // Check what other types there are
    const c2 = await prisma.client.findMany({ take: 10 });
    for (const c of c2) {
        console.log(`${c.id}: type=${c.clientType}, name=${c.firstName} ${c.lastName}, bName=${c.businessName}`);
    }
}
main().finally(() => prisma.$disconnect());
