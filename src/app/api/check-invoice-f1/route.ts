import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceData: { not: null } }
  });

  return NextResponse.json(inv);
}
