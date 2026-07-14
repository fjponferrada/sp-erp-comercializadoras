import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const supply = await prisma.supplyPoint.findFirst({
        where: { cups: 'ES0031101402139001ZV0F' },
        include: { client: true, contracts: true }
    });
    
    if (!supply) {
        console.log("No supply point found.");
        return;
    }
    
    console.log(`SupplyPoint: ${supply.cups}`);
    console.log(`Client: ${supply.client.businessName} (VAT: ${supply.client.vatNumber})`);
    for (const contract of supply.contracts) {
        console.log(`- Contract: ${contract.contractCode} (Status: ${contract.status})`);
    }
}

main().finally(() => prisma.$disconnect());
