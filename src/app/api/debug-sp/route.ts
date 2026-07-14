import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cups = 'ES0031105360168001RA0F';
  const sps = await prisma.supplyPoint.findMany({
    where: { cups },
    include: { client: true, contracts: { include: { client: true } } }
  });
  return NextResponse.json(sps.map(s => ({
    id: s.id,
    cups: s.cups,
    clientId: s.clientId,
    clientName: s.client?.businessName || (s.client?.firstName ? `${s.client.firstName} ${s.client.lastName || ''}`.trim() : null),
    contracts: s.contracts.map(c => ({
      id: c.id,
      code: c.contractCode,
      status: c.status,
      clientId: c.clientId,
      clientName: c.client?.businessName || (c.client?.firstName ? `${c.client.firstName} ${c.client.lastName || ''}`.trim() : null)
    }))
  })));
}
