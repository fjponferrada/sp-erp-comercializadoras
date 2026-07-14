import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const supplies = await prisma.supplyPoint.findMany({
        where: { cups: 'ES0031101402139001ZV0F' },
        include: { client: true, contracts: true }
    });
    
    for (const supply of supplies) {
        console.log(`\nSupplyPoint: ${supply.cups} (ID: ${supply.id})`);
        console.log(`Client: ${supply.client.businessName} (VAT: ${supply.client.vatNumber})`);
        for (const contract of supply.contracts) {
            console.log(`- Contract: ${contract.contractCode} (Status: ${contract.status})`);
        }
    }
}

main().finally(() => prisma.$disconnect());
