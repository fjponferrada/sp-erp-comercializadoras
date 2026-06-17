import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting client name fix...");
    const clients = await prisma.client.findMany({
        where: { clientType: 'Persona física' },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            contracts: {
                select: { airtableData: true },
                where: { airtableData: { not: null } },
                take: 1
            }
        }
    });

    let fixedCount = 0;
    for (const client of clients) {
        if (client.contracts.length > 0) {
            const data = client.contracts[0].airtableData as any;
            let firstName = data['NOMBRERAZON SOCIAL'] || data['Nombre'];
            let lastName1 = data['Primer Apellido'] || '';
            let lastName2 = data['Segundo Apellido'] || '';
            let lastName = `${lastName1} ${lastName2}`.trim();

            if (firstName && lastName) {
                // Check if it's currently wrong
                if (client.firstName !== firstName || client.lastName !== lastName) {
                    await prisma.client.update({
                        where: { id: client.id },
                        data: { firstName: firstName.toString().trim(), lastName: lastName.toString().trim() }
                    });
                    fixedCount++;
                }
            }
        }
    }
    console.log(`Fixed ${fixedCount} client names from Contract Airtable data.`);
}

main().finally(() => prisma.$disconnect());
