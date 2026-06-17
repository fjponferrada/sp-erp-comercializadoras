import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cupsList = ["ES0031101402139001ZV0F", "ES0031103463064001WN0F", "ES0031103121712032YJ0F"];
    const sps = await prisma.supplyPoint.findMany({
        where: { cups: { in: cupsList } },
        include: { contracts: true }
    });

    for (const sp of sps) {
        console.log(`CUPS: ${sp.cups}`);
        console.log(`  annualConsumption: ${sp.annualConsumption}`);
        for (const c of sp.contracts) {
            const ad = c.airtableData as any;
            if (ad) {
                console.log(`  Contract Airtable CONSUMO COMISION: ${ad['CONSUMO COMISION']}`);
                console.log(`  Contract Airtable CONSUMO ANUAL KWH: ${ad['CONSUMO ANUAL KWH']}`);
                console.log(`  Contract Airtable CONSUMO ANUAL: ${ad['CONSUMO ANUAL']}`);
            }
        }
    }
}
main().finally(() => prisma.$disconnect());
