import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    // Fix postal codes
    const zeroZips = await prisma.supplyPoint.findMany({
        where: { postalCode: '00000' }
    });

    let zipFixed = 0;
    for (const sp of zeroZips) {
        let realZip = null;
        if (sp.airtableData && (sp.airtableData as any)['Código Postal Instalación']) {
            realZip = (sp.airtableData as any)['Código Postal Instalación'];
        } else {
            // Try to extract from address string: look for 5 digits
            const match = sp.address.match(/\b(\d{5})\b/);
            if (match) {
                realZip = match[1];
            }
        }

        if (realZip) {
            await prisma.supplyPoint.update({
                where: { id: sp.id },
                data: { postalCode: realZip }
            });
            zipFixed++;
        } else {
            console.log(`Could not fix ZIP for SP ${sp.id} (Address: ${sp.address})`);
        }
    }
    console.log(`Fixed ${zipFixed} postal codes.`);

    // Fix weird CUPS
    const weirdCups = await prisma.supplyPoint.findMany({
        where: { cups: { startsWith: 'CUPS_' } }
    });

    let cupsFixed = 0;
    for (const sp of weirdCups) {
        let realCups = null;
        if (sp.airtableData && (sp.airtableData as any)['CUPS Instalación']) {
            realCups = (sp.airtableData as any)['CUPS Instalación'];
        }

        if (realCups && typeof realCups === 'string' && realCups.startsWith('ES')) {
            await prisma.supplyPoint.update({
                where: { id: sp.id },
                data: { cups: realCups }
            });
            cupsFixed++;
        } else {
            // If no real CUPS is found, maybe delete it or leave it?
            // User says "un cups con formato raro...". Let's check if there is a contract attached
            const cCount = await prisma.contract.count({ where: { supplyPointId: sp.id } });
            if (cCount === 0) {
                await prisma.supplyPoint.delete({ where: { id: sp.id } });
                console.log(`Deleted weird empty CUPS ${sp.cups}`);
            } else {
                console.log(`Weird CUPS ${sp.cups} has contracts! Cannot safely delete without CUPS.`);
            }
        }
    }
    console.log(`Fixed/Deleted ${cupsFixed} weird CUPS.`);
}

main().finally(() => prisma.$disconnect());
