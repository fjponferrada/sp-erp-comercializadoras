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
    console.log("Fetching all clients for deduplication...");
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
        if (norm.length < 4) continue;

        if (!groups.has(norm)) groups.set(norm, []);
        groups.get(norm)!.push(c);
    }

    let mergedGroups = 0;
    
    for (const [norm, group] of groups.entries()) {
        const uniqueVats = new Set(group.map(c => c.vatNumber));
        if (group.length > 1 && uniqueVats.size > 1) {
            console.log(`\nMerging duplicate group: "${norm}"`);
            
            // Sort to find the best primary client
            // 1. Has most contracts + SPs
            // 2. VAT format looks more correct (starts with letter for companies, has correct length, etc)
            group.sort((a, b) => {
                const aCount = a._count.contracts + a._count.supplyPoints;
                const bCount = b._count.contracts + b._count.supplyPoints;
                if (aCount !== bCount) return bCount - aCount; // descending
                
                // If counts are equal, prefer the one with standard VAT length (9 chars)
                const aValid = a.vatNumber && a.vatNumber.length === 9;
                const bValid = b.vatNumber && b.vatNumber.length === 9;
                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;
                
                return 0;
            });

            const primary = group[0];
            const duplicates = group.slice(1);

            console.log(`  Primary: ${primary.id} | VAT: ${primary.vatNumber} | Name: ${primary.businessName}`);
            
            for (const dup of duplicates) {
                console.log(`    Merging duplicate: ${dup.id} | VAT: ${dup.vatNumber} ...`);
                
                // Update SupplyPoints
                await prisma.supplyPoint.updateMany({ where: { clientId: dup.id }, data: { clientId: primary.id } });
                
                // Update Contracts
                await prisma.contract.updateMany({ where: { clientId: dup.id }, data: { clientId: primary.id } });
                
                // Update Leads
                await prisma.lead.updateMany({ where: { vatNumber: dup.vatNumber }, data: { vatNumber: primary.vatNumber } });
                
                // Update Invoices
                await prisma.invoice.updateMany({ where: { clientId: dup.id }, data: { clientId: primary.id } });
                
                // Update Tickets
                await prisma.ticket.updateMany({ where: { clientId: dup.id }, data: { clientId: primary.id } });
                
                // Update Solar Quotes
                await prisma.solarQuote.updateMany({ where: { clientId: dup.id }, data: { clientId: primary.id } });
                
                // Update Documents
                await prisma.document.updateMany({ where: { clientId: dup.id }, data: { clientId: primary.id } });
                
                // Delete duplicate
                try {
                    await prisma.client.delete({ where: { id: dup.id } });
                    console.log(`      Successfully deleted ${dup.id}`);
                } catch (e: any) {
                    console.log(`      [WARN] Could not delete ${dup.id}: ${e.message}`);
                }
            }
            mergedGroups++;
        }
    }

    console.log(`\nFinished merging ${mergedGroups} duplicate client groups.`);
}

main().finally(() => prisma.$disconnect());
