import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const contracts = await prisma.contract.findMany({
        where: { contractCode: 'PRPR258131256ZV0F' },
        include: { client: true }
    });
    console.log(`Found ${contracts.length} contracts with PRPR258131256ZV0F`);
    for (const c of contracts) {
        console.log(`- AirtableID: ${c.airtableId}, Status: ${c.status}, Client: ${c.client.businessName}`);
    }
}

main().finally(() => prisma.$disconnect());
