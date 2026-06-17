import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cupsList = ["ES0031101351698001TH", "ES0031101460742001PY"];
    const sps = await prisma.supplyPoint.findMany({
        where: { cups: { in: cupsList } },
        include: { client: true }
    });

    for (const sp of sps) {
        console.log(`\nCUPS: ${sp.cups}`);
        console.log(`  Client ID: ${sp.clientId}`);
        console.log(`  Client Name: ${sp.client?.businessName}`);
        
        const clientContracts = await prisma.contract.findMany({
            where: { clientId: sp.clientId }
        });
        console.log(`  Total contracts for this client: ${clientContracts.length}`);
        
        for (const c of clientContracts) {
            console.log(`  [Contract] ID: ${c.id}, CUPS from DB relation: ${c.supplyPointId}, Status: ${c.status}`);
        }
        
        if (sp.airtableData) {
            console.log(`  Has airtableData in SupplyPoint: YES`);
            console.log(`    CONSUMO COMISION: ${(sp.airtableData as any)['CONSUMO COMISION']}`);
        } else {
            console.log(`  Has airtableData in SupplyPoint: NO`);
        }
    }
}
main().finally(() => prisma.$disconnect());
