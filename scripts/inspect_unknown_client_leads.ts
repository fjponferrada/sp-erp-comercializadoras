import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const leads = await prisma.lead.findMany({
        where: { vatNumber: '30966737C' }
    });
    
    console.log(`Leads for client cmq6zh0pa0ysbic4134r4yio2: ${leads.length}`);
    for (const l of leads) {
        console.log(`  Lead ID: ${l.id}, Status: ${l.status}, CUPS: ${l.cups}`);
        if (l.airtableData) {
            const ad = l.airtableData as any;
            console.log(`    NOMBRERAZON SOCIAL: ${ad['NOMBRERAZON SOCIAL']}`);
            console.log(`    Nombre: ${ad['Nombre']}`);
        }
    }
}
main().finally(() => prisma.$disconnect());
