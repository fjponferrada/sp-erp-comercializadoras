import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting fix for unknown clients...");
    const clients = await prisma.client.findMany({
        where: {
            OR: [
                { businessName: '' },
                { businessName: 'Desconocido' },
                { businessName: 'null null' },
                { firstName: null }
            ]
        },
        include: {
            contracts: { select: { airtableData: true } }
        }
    });

    console.log(`Found ${clients.length} clients to check.`);
    
    let fixedCount = 0;
    for (const client of clients) {
        let ad: any = null;
        if (client.contracts.length > 0 && client.contracts[0].airtableData) {
            ad = client.contracts[0].airtableData;
        } else {
            // Check leads
            const leads = await prisma.lead.findMany({ where: { vatNumber: client.vatNumber } });
            if (leads.length > 0 && leads[0].airtableData) {
                ad = leads[0].airtableData;
            }
        }
        
        if (ad) {
            let firstName = ad['NOMBRERAZON SOCIAL'] || ad['Nombre'] || '';
            let lastName1 = ad['Primer Apellido'] || '';
            let lastName2 = ad['Segundo Apellido'] || '';
            let lastName = `${lastName1} ${lastName2}`.trim();
            
            firstName = firstName.toString().trim();
            
            if (!firstName && lastName) {
                firstName = lastName;
                lastName = '';
            }
            
            if (firstName) {
                let businessName = client.clientType === 'Persona física' ? `${firstName} ${lastName}`.trim() : firstName;
                
                await prisma.client.update({
                    where: { id: client.id },
                    data: { 
                        firstName: firstName || null, 
                        lastName: lastName || null, 
                        businessName: businessName 
                    }
                });
                fixedCount++;
            }
        } else {
            // No airtable data found, if businessName is completely empty, fallback to vatNumber or "Desconocido"
            if (!client.businessName || client.businessName.trim() === '') {
                await prisma.client.update({
                    where: { id: client.id },
                    data: { businessName: 'Desconocido' }
                });
                fixedCount++;
            }
        }
    }
    
    // Also catch any client where businessName is still empty for ANY reason
    const emptyClients = await prisma.client.findMany({ where: { businessName: '' } });
    for (const ec of emptyClients) {
        await prisma.client.update({
            where: { id: ec.id },
            data: { businessName: ec.firstName || 'Desconocido' }
        });
    }

    console.log(`Fixed ${fixedCount} unknown clients.`);
}

main().finally(() => prisma.$disconnect());
