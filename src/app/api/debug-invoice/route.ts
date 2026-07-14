import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || 'A24-10-06768';
  const cups = url.searchParams.get('cups');
  
  let result: any = {};
  
  if (cups) {
    const sp = await prisma.supplyPoint.findFirst({
      where: { cups },
      include: { 
        invoices: { select: { invoiceNumber: true, billingEnd: true, supplyPointId: true } },
        contracts: true
      }
    });
    result.sp = sp;
  }
  
  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: q },
    include: { supplyPoint: true }
  });

  const f1 = await prisma.f1Invoice.findFirst({
    where: { numeroFactura: q },
    include: { supplyPoint: true }
  });

  result.invoice = invoice;
  result.f1 = f1;

  return NextResponse.json(result);
}
