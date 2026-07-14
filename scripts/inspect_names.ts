import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cupsList = ["ES0031103463064001WN0F", "ES0031101402293002VX0F"];
    const sps = await prisma.supplyPoint.findMany({
        where: { cups: { in: cupsList } },
        include: { 
            client: true,
            contracts: {
                select: { airtableData: true }
            }
        }
    });

    for (const sp of sps) {
        console.log(`\nCUPS: ${sp.cups}`);
        console.log(`  Client ID: ${sp.client?.id}`);
        console.log(`  firstName: ${sp.client?.firstName}`);
        console.log(`  lastName: ${sp.client?.lastName}`);
        console.log(`  businessName: ${sp.client?.businessName}`);
        
        for (const c of sp.contracts) {
            const ad = c.airtableData as any;
            if (ad) {
                console.log(`  [Contract Airtable Data]`);
                console.log(`    NOMBRERAZON SOCIAL: ${ad['NOMBRERAZON SOCIAL']}`);
                console.log(`    Nombre: ${ad['Nombre']}`);
                console.log(`    Primer Apellido: ${ad['Primer Apellido']}`);
                console.log(`    Segundo Apellido: ${ad['Segundo Apellido']}`);
                console.log(`    CONTROLSAGE: ${ad['CONTROLSAGE']}`);
            }
        }
    }
}
main().finally(() => prisma.$disconnect());
