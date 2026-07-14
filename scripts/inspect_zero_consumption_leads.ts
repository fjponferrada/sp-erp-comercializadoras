import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cupsList = ["ES0031101351698001TH", "ES0031101460742001PY"];
    const sps = await prisma.supplyPoint.findMany({
        where: { cups: { in: cupsList } }
    });

    for (const sp of sps) {
        console.log(`\nCUPS: ${sp.cups}`);
        console.log(`  annualConsumption in DB: ${sp.annualConsumption}`);
        
        const leads = await prisma.lead.findMany({
            where: { cups: sp.cups },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`  Number of Leads: ${leads.length}`);
        
        for (const l of leads) {
            const ad = l.airtableData as any;
            if (ad) {
                console.log(`  [Lead] Status: ${l.status}, CreatedAt: ${l.createdAt}`);
                console.log(`  [Lead] CONSUMO COMISION: ${ad['CONSUMO COMISION']}`);
                console.log(`  [Lead] CONSUMO ANUAL KWH: ${ad['CONSUMO ANUAL KWH']}`);
            } else {
                console.log(`  [Lead] Status: ${l.status}, CreatedAt: ${l.createdAt} (NO AIRTABLE DATA)`);
            }
        }
    }
}
main().finally(() => prisma.$disconnect());
