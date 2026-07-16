import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const f1A = await prisma.f1Invoice.findMany({
    where: { 
      tipoDocumento: 'A', // Sometimes TipoFactura is stored here, or we need to check jsonData
    },
    take: 5
  });

  const internalA = await prisma.internalInvoice.findMany({
    where: {
      f1Invoice: {
        numeroFactura: { startsWith: 'A' } // Just a guess
      }
    },
    take: 5,
    include: { f1Invoice: true }
  });

  // Find F1s by JSON TipoFactura = 'A'
  const f1s = await prisma.f1Invoice.findMany({
    take: 100,
    select: { id: true, numeroFactura: true, jsonData: true }
  });

  const aTypes = f1s.filter(f => {
    const dGen = (f.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura || (f.jsonData as any)?.DatosGeneralesFactura;
    return dGen?.TipoFactura === 'A' || dGen?.TipoFactura?.[0] === 'A';
  }).map(f => f.numeroFactura);

  return NextResponse.json({ 
    f1ACount: f1A.length, 
    aTypes 
  });
}
