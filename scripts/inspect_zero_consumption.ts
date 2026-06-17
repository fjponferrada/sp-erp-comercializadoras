import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cupsList = ["ES0031101351698001TH", "ES0031101460742001PY"];
    const sps = await prisma.supplyPoint.findMany({
        where: { cups: { in: cupsList } },
        include: { 
            contracts: {
                select: { airtableData: true, createdAt: true, status: true }
            }
        }
    });

    for (const sp of sps) {
        console.log(`\nCUPS: ${sp.cups}`);
        console.log(`  annualConsumption in DB: ${sp.annualConsumption}`);
        console.log(`  Number of Contracts: ${sp.contracts.length}`);
        for (const c of sp.contracts) {
            const ad = c.airtableData as any;
            if (ad) {
                console.log(`  [Contract] Status: ${c.status}, CreatedAt: ${c.createdAt}`);
                console.log(`  [Contract] CONSUMO COMISION: ${ad['CONSUMO COMISION']}`);
                console.log(`  [Contract] CONSUMO ANUAL KWH: ${ad['CONSUMO ANUAL KWH']}`);
            }
        }
    }
}
main().finally(() => prisma.$disconnect());
