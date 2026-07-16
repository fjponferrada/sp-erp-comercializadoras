import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const arInvoices = await prisma.f1Invoice.findMany({
      where: {
        numeroFactura: { startsWith: 'AR-' },
      }
    });

    let updated = 0;

    for (const ar of arInvoices) {
      if (!ar.numeroFactura) continue;
      
      const origCode = ar.numeroFactura.replace('AR-', '');
      
      // Encontrar la factura R que originó este AR
      const rInvoice = await prisma.f1Invoice.findFirst({
        where: {
          jsonData: {
            path: ['DatosGeneralesFacturaATR', 'DatosGeneralesFactura', 'TipoFactura'],
            string_contains: 'R'
          },
          OR: [
            {
              jsonData: {
                path: ['DatosGeneralesFacturaATR', 'DatosGeneralesFactura', 'CodigoFacturaRectificadaAnulada'],
                equals: origCode
              }
            },
            {
              jsonData: {
                path: ['DatosGeneralesOtrasFacturas', 'DatosGeneralesFactura', 'CodigoFacturaRectificadaAnulada'],
                equals: origCode
              }
            }
          ]
        }
      });

      if (rInvoice && rInvoice.fechaEmision) {
        if (ar.fechaEmision?.getTime() !== rInvoice.fechaEmision.getTime()) {
          await prisma.f1Invoice.update({
            where: { id: ar.id },
            data: { fechaEmision: rInvoice.fechaEmision }
          });
          updated++;
        }
      }
    }

    return NextResponse.json({ success: true, message: `Se han actualizado las fechas de emisión de ${updated} facturas AR fantasmas.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
