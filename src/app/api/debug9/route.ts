import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const drafts = await prisma.internalInvoice.findMany({
      where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({
      drafts: drafts.map(d => ({
        id: d.id,
        status: d.status,
        createdAt: d.createdAt,
        repairData: d.repairData
      }))
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
