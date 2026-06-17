import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const client = await prisma.client.findFirst({
        where: { vatNumber: '30966737C' },
        include: {
            contracts: { select: { airtableData: true } }
        }
    });

    if (!client) {
        console.log("Client not found.");
        return;
    }

    console.log("Client details:");
    console.log(`  ID: ${client.id}`);
    console.log(`  BusinessName: ${client.businessName}`);
    console.log(`  FirstName: ${client.firstName}`);
    console.log(`  LastName: ${client.lastName}`);
    
    console.log(`\nContracts: ${client.contracts.length}`);
    for (const c of client.contracts) {
        const ad = c.airtableData as any;
        if (ad) {
            console.log(`  [Contract Airtable Data]`);
            console.log(`    NOMBRERAZON SOCIAL: ${ad['NOMBRERAZON SOCIAL']}`);
            console.log(`    Nombre: ${ad['Nombre']}`);
            console.log(`    Primer Apellido: ${ad['Primer Apellido']}`);
            console.log(`    Segundo Apellido: ${ad['Segundo Apellido']}`);
            console.log(`    Titular: ${ad['Titular']}`);
            console.log(`    TITULAR DEL CONTRATO: ${ad['TITULAR DEL CONTRATO']}`);
            console.log(`    TITULAR DEL CONTRATO LINK: ${ad['TITULAR DEL CONTRATO LINK']}`);
        }
    }
}
main().finally(() => prisma.$disconnect());
