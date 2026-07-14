import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const allClients = await prisma.client.findMany({
      select: { id: true, businessName: true, vatNumber: true }
    });

    // Group by business name
    const byName: Record<string, typeof allClients> = {};
    for (const c of allClients) {
      const name = c.businessName ? c.businessName.trim().toUpperCase() : '';
      if (!name) continue;
      if (!byName[name]) byName[name] = [];
      byName[name].push(c);
    }

    const duplicates = [];
    for (const [name, clients] of Object.entries(byName)) {
      if (clients.length > 1) {
        // Check if one is a CIF and the other is a DNI
        const hasCif = clients.some(c => c.vatNumber.match(/^[A-W]/i));
        const hasDni = clients.some(c => c.vatNumber.match(/^[0-9XYZ]/i));
        if (hasCif && hasDni) {
          duplicates.push({ name, clients });
        }
      }
    }

    return NextResponse.json({
      totalDuplicateGroups: duplicates.length,
      sample: duplicates.slice(0, 5)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
