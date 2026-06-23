import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const c = await prisma.$queryRaw`
    SELECT COUNT(*) FROM "F1Invoice" f1
    LEFT JOIN "Invoice" i ON i."invoiceData"->>'Numero Factura .xml' = CONCAT(f1."numeroFactura", '.xml')
    WHERE i.id IS NOT NULL;
  `;

  return NextResponse.json({ count: c });
}
