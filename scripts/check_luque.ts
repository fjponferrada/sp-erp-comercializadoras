import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const clients = await prisma.client.findMany({
        where: { businessName: { contains: 'LUQUE' } },
        include: { supplyPoints: true, contracts: true }
    });
    
    for (const c of clients) {
        console.log(`Client: ${c.businessName} (VAT: ${c.vatNumber})`);
        for (const s of c.supplyPoints) {
            console.log(`  - Supply: ${s.cups}`);
        }
        for (const ct of c.contracts) {
            console.log(`  - Contract: ${ct.contractCode} (Status: ${ct.status}, SP_ID: ${ct.supplyPointId})`);
        }
    }
}

main().finally(() => prisma.$disconnect());
