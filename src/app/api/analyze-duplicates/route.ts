import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // Find duplicate clients (same vatNumber, same brand)
  const allClients = await prisma.client.findMany({ select: { id: true, vatNumber: true, brandId: true } });
  
  const clientGroups: Record<string, string[]> = {};
  for (const c of allClients) {
    if (!c.vatNumber) continue;
    const key = `${c.vatNumber.trim().toUpperCase()}_${c.brandId}`;
    if (!clientGroups[key]) clientGroups[key] = [];
    clientGroups[key].push(c.id);
  }

  const dupClientGroups = Object.entries(clientGroups)
    .filter(([k, ids]) => ids.length > 1)
    .map(([k, ids]) => ({ key: k, ids }));

  // Find duplicate supply points (same CUPS, same or different client but same vatNumber)
  const allSPs = await prisma.supplyPoint.findMany({ select: { id: true, cups: true, clientId: true, client: { select: { vatNumber: true, brandId: true } } } });
  
  const spGroups: Record<string, string[]> = {};
  for (const sp of allSPs) {
    if (!sp.cups) continue;
    const baseCups = sp.cups.trim().substring(0, 20).toUpperCase();
    const vat = sp.client?.vatNumber?.trim().toUpperCase() || 'NOVAT';
    const brand = sp.client?.brandId || 'NOBRAND';
    const key = `${baseCups}_${vat}_${brand}`;
    
    if (!spGroups[key]) spGroups[key] = [];
    spGroups[key].push(sp.id);
  }

  const dupSpGroups = Object.entries(spGroups)
    .filter(([k, ids]) => ids.length > 1)
    .map(([k, ids]) => ({ key: k, ids }));

  return NextResponse.json({
    totalClients: allClients.length,
    duplicateClientGroups: dupClientGroups.length,
    totalDuplicateClients: dupClientGroups.reduce((acc, g) => acc + g.ids.length, 0),
    totalSPs: allSPs.length,
    duplicateSpGroups: dupSpGroups.length,
    totalDuplicateSPs: dupSpGroups.reduce((acc, g) => acc + g.ids.length, 0),
    sampleClients: dupClientGroups.slice(0, 5),
    sampleSPs: dupSpGroups.slice(0, 5)
  });
}
