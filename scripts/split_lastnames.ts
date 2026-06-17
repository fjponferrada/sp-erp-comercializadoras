import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting split of last names...");
    const clients = await prisma.client.findMany({
        where: { clientType: 'Persona física' },
        include: {
            contracts: { select: { airtableData: true } }
        }
    });

    let updatedCount = 0;
    
    for (const client of clients) {
        let ad: any = null;
        if (client.contracts.length > 0 && client.contracts[0].airtableData) {
            ad = client.contracts[0].airtableData;
        } else {
            const leads = await prisma.lead.findMany({ where: { vatNumber: client.vatNumber } });
            if (leads.length > 0 && leads[0].airtableData) {
                ad = leads[0].airtableData;
            }
        }
        
        let newLastName1 = client.lastName || '';
        let newLastName2 = client.lastName2 || '';
        
        let updated = false;

        // Try from airtable data first
        if (ad && (ad['Primer Apellido'] || ad['Segundo Apellido'])) {
            const ap1 = ad['Primer Apellido'] ? String(ad['Primer Apellido']).trim() : '';
            const ap2 = ad['Segundo Apellido'] ? String(ad['Segundo Apellido']).trim() : '';
            
            if (ap1 || ap2) {
                newLastName1 = ap1;
                newLastName2 = ap2;
                updated = true;
            }
        } 
        // If not in airtable data, try to split existing lastName by space
        else if (client.lastName && !client.lastName2 && client.lastName.trim().includes(' ')) {
            const parts = client.lastName.trim().split(/\s+/);
            // It's a bit naive, but if there's multiple parts we can put first in lastName and rest in lastName2
            if (parts.length >= 2) {
                newLastName1 = parts[0];
                newLastName2 = parts.slice(1).join(' ');
                updated = true;
            }
        }

        if (updated) {
            await prisma.client.update({
                where: { id: client.id },
                data: {
                    lastName: newLastName1 || null,
                    lastName2: newLastName2 || null
                }
            });
            updatedCount++;
        }
    }

    console.log(`Finished splitting last names for ${updatedCount} clients.`);
}

main().finally(() => prisma.$disconnect());
