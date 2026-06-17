import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

function normalizeName(name: string) {
    if (!name) return '';
    return name
        .toUpperCase()
        .replace(/\./g, '')
        .replace(/,/g, '')
        .replace(/\s+S\s*L\b/g, '')
        .replace(/\s+S\s*A\b/g, '')
        .replace(/\s+SOCIEDAD LIMITADA\b/g, '')
        .trim();
}

async function main() {
    console.log("Fetching all clients to find businessName duplicates with different vatNumbers...");
    const clients = await prisma.client.findMany({
        select: {
            id: true,
            vatNumber: true,
            businessName: true,
            clientType: true,
            _count: {
                select: { supplyPoints: true, contracts: true }
            }
        }
    });

    const groups = new Map<string, typeof clients>();

    for (const c of clients) {
        if (!c.businessName || c.businessName === 'Desconocido') continue;
        
        const norm = normalizeName(c.businessName);
        if (norm.length < 4) continue; // Skip very short generic names

        if (!groups.has(norm)) groups.set(norm, []);
        groups.get(norm)!.push(c);
    }

    let duplicateGroups = 0;
    for (const [norm, group] of groups.entries()) {
        if (group.length > 1) {
            // Check if they have different vatNumbers
            const uniqueVats = new Set(group.map(c => c.vatNumber));
            if (uniqueVats.size > 1) {
                console.log(`\nPotential duplicate group for normalized name: "${norm}"`);
                for (const c of group) {
                    console.log(`  ID: ${c.id} | VAT: ${c.vatNumber} | Name: ${c.businessName} | Type: ${c.clientType} | SPs: ${c._count.supplyPoints} | Contracts: ${c._count.contracts}`);
                }
                duplicateGroups++;
            }
        }
    }

    console.log(`\nFound ${duplicateGroups} potential duplicate groups based on normalized business name.`);
}

main().finally(() => prisma.$disconnect());
