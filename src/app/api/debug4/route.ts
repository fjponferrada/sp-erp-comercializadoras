import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const invoice = await prisma.internalInvoice.findFirst({
      where: {
        contract: {
          supplyPoint: {
            cups: 'ES0031405446869086QD0F'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!invoice) return NextResponse.json({ error: 'not found' });

    return NextResponse.json(invoice);
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
