import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const arF1s = await prisma.f1Invoice.findMany({
      where: {
        numeroFactura: { startsWith: 'AR-' },
      },
      include: { invoices: true }
    });
    
    let linkedCount = 0;
    
    for (const ar of arF1s) {
      if (ar.invoices && ar.invoices.length > 0) continue; // Already linked
      if (!ar.numeroFactura) continue;
      
      const originalCod = ar.numeroFactura.replace('AR-', '');
      const originalF1 = await prisma.f1Invoice.findFirst({
        where: { numeroFactura: originalCod },
        include: { invoices: true }
      });
      
      if (!originalF1 || !originalF1.invoices || originalF1.invoices.length === 0) {
        continue;
      }
      
      const originalTotal = originalF1.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const inverseTotal = -originalTotal;
      
      if (inverseTotal >= 0) continue; // Must be a negative value
      
      const abonoInvoice = await prisma.invoice.findFirst({
        where: {
          supplyPointId: ar.supplyPointId,
          f1InvoiceId: null, // Unlinked
          totalAmount: {
            gte: inverseTotal - 0.05,
            lte: inverseTotal + 0.05
          }
        }
      });
      
      if (abonoInvoice) {
        await prisma.invoice.update({
          where: { id: abonoInvoice.id },
          data: { f1InvoiceId: ar.id }
        });
        linkedCount++;
      }
    }

    return NextResponse.json({ success: true, message: `Se han vinculado ${linkedCount} facturas de abono de proveedor con sus F1 AR correspondientes.` });
  } catch (error: any) {
    console.error("Error en fix-abonos:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
