import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Fetching all supply points for suffix deduplication...');
  const allSupplyPoints = await prisma.supplyPoint.findMany({
    select: {
      id: true,
      cups: true,
      clientId: true,
      contracts: { select: { id: true, status: true, createdAt: true } },
      invoices: { select: { id: true } },
      tickets: { select: { id: true } },
      solarQuotes: { select: { id: true } },
      documents: { select: { id: true } },
      switchingEvents: { select: { id: true } },
      f1Invoices: { select: { id: true } }
    }
  });

  // Group by base CUPS (first 20 chars) + clientId
  const grouped = new Map<string, typeof allSupplyPoints>();
  for (const sp of allSupplyPoints) {
    if (!sp.cups || !sp.clientId) continue;
    const baseCups = sp.cups.substring(0, 20);
    const key = `${baseCups}-${sp.clientId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(sp);
  }

  let mergedCount = 0;

  for (const [key, sps] of grouped.entries()) {
    if (sps.length <= 1) continue;

    console.log(`\nFound duplicate for ${key} (${sps.length} records)`);

    // Primary rule:
    // 1. Has active contract
    // 2. Most recent contract
    // 3. Has 0F suffix? Actually we don't care as long as we keep the one with data
    sps.sort((a, b) => {
      const aActive = a.contracts.some(c => c.status === 'Activo' || c.status === 'ACTIVO');
      const bActive = b.contracts.some(c => c.status === 'Activo' || c.status === 'ACTIVO');
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      const aMostRecentContract = Math.max(...a.contracts.map(c => c.createdAt.getTime()), 0);
      const bMostRecentContract = Math.max(...b.contracts.map(c => c.createdAt.getTime()), 0);
      if (aMostRecentContract !== bMostRecentContract) {
        return bMostRecentContract - aMostRecentContract;
      }

      return b.id.localeCompare(a.id);
    });

    const primary = sps[0];
    const duplicates = sps.slice(1);

    console.log(`Primary ID: ${primary.id} (CUPS: ${primary.cups})`);
    
    for (const dup of duplicates) {
      console.log(`  Merging ${dup.id} (CUPS: ${dup.cups}) into primary...`);
      
      if (dup.contracts.length > 0) {
        await prisma.contract.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }
      if (dup.invoices.length > 0) {
        await prisma.invoice.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }
      if (dup.tickets.length > 0) {
        await prisma.ticket.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }
      if (dup.solarQuotes.length > 0) {
        await prisma.solarQuote.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }
      if (dup.documents.length > 0) {
        await prisma.document.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }
      if (dup.switchingEvents.length > 0) {
        await prisma.switchingEvent.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }
      if (dup.f1Invoices.length > 0) {
        await prisma.f1Invoice.updateMany({ where: { supplyPointId: dup.id }, data: { supplyPointId: primary.id } });
      }

      // Also update Leads
      await prisma.lead.updateMany({ where: { cups: dup.cups }, data: { cups: primary.cups } });

      try {
        await prisma.supplyPoint.delete({ where: { id: dup.id } });
      } catch (e: any) {
        console.log(`  [WARN] Could not delete ${dup.id}: ${e.message}`);
      }
      mergedCount++;
    }
  }

  console.log(`\nDone. Merged ${mergedCount} duplicate SupplyPoints due to suffixes.`);
}

main().finally(() => prisma.$disconnect());
