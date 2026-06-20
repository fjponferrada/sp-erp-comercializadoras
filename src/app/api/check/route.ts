import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: ['A260614793', 'A260614877', 'A260615017'] } }
  });

  return NextResponse.json(invoices.map(i => ({
    num: i.invoiceNumber,
    issueDate: i.issueDate,
    billingEnd: i.billingEnd,
    origin: i.origin,
    data: i.invoiceData
  })));
}
