import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import React from 'react';
import { InvoicePdfTemplate } from '@/components/pdf/InvoicePdfTemplate';
import { renderToStream } from '@react-pdf/renderer';

export async function GET(req: Request, context: { params: Promise<{ draftId: string }> }) {
  try {
    const session = await auth();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });

    const params = await context.params;
    const { draftId } = params;
    if (!draftId) return new NextResponse('Missing draftId', { status: 400 });

    const invoice = await prisma.internalInvoice.findUnique({
      where: { id: draftId },
      include: {
        client: true,
        contract: {
          include: { supplyPoint: true }
        }
      }
    });

    if (!invoice) return new NextResponse('Not found', { status: 404 });

    const templateData = {
      invoiceNumber: invoice.invoiceNumber || `PROFORMA-${invoice.id.substring(0,6).toUpperCase()}`,
      invoiceType: invoice.invoiceType,
      issueDate: invoice.issueDate,
      clientName: invoice.client?.businessName || 'Desconocido',
      clientNif: invoice.client?.vatNumber || 'S/N',
      clientAddress: invoice.client?.billingAddress || '',
      cups: invoice.contract?.supplyPoint?.cups || 'S/N',
      tariff: invoice.contract?.supplyPoint?.tariff || '',
      contractedPower: invoice.contract?.p1p || '',
      billingStart: invoice.billingStart,
      billingEnd: invoice.billingEnd,
      totalMWh: invoice.totalMWh,
      subtotal1: invoice.subtotal1,
      taxPercentage: invoice.taxPercentage,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      
      powerDetails: (invoice.invoiceData as any)?.powerDetails || [],
      energyAtrDetails: (invoice.invoiceData as any)?.energyAtrDetails || [],
      energyMarketDetails: (invoice.invoiceData as any)?.energyMarketDetails || [],
      alquilerEquipo: (invoice.invoiceData as any)?.alquilerEquipo || 0,
      bonoSocial: (invoice.invoiceData as any)?.bonoSocial || 0,
      taxElectric: (invoice.invoiceData as any)?.taxElectric || 0,
      excesosPotencia: (invoice.invoiceData as any)?.excesosPotencia || 0,
      excedentesAutoconsumo: (invoice.invoiceData as any)?.excedentesAutoconsumo || 0,
      excedentesKwh: (invoice.invoiceData as any)?.excedentesKwh || 0,
      maxExcedentes: (invoice.invoiceData as any)?.maxExcedentes || 0,
      bolsilloSolarLlenado: (invoice.invoiceData as any)?.bolsilloSolarLlenado || 0,
      f1Readings: (invoice.invoiceData as any)?.f1Readings || null,
      reactiveDetails: (invoice.invoiceData as any)?.reactiveDetails || [],
      svaCost: (invoice.invoiceData as any)?.svaCost || 0,
      svaConcept: (invoice.invoiceData as any)?.svaConcept || '',
    };

    const element = React.createElement(InvoicePdfTemplate, { data: templateData }) as any;
    const pdfStream = await renderToStream(element);
    
    // We can pipe the stream directly to the NextResponse, but Next.js responses can take web streams or buffers.
    // Let's buffer it and return it as a Blob/Buffer.
    const pdfChunks: any[] = [];
    for await (const chunk of pdfStream) {
      pdfChunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(pdfChunks);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Proforma-${templateData.invoiceNumber}.pdf"`
      }
    });
  } catch (error: any) {
    console.error('Error generating proforma pdf:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
