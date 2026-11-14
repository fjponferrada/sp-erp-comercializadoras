import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import React from 'react';
import { InvoicePdfTemplate } from '@/components/pdf/InvoicePdfTemplate';
import { renderToStream } from '@react-pdf/renderer';
import { buildInvoiceTemplateData } from '@/lib/services/internalInvoiceMapper';

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
        client: {
          include: {
            brand: { include: { company: true } },
          },
        },
        company: true,
        supplyPoint: true,
        f1Invoice: {
          include: { supplyPoint: true },
        },
        contract: {
          include: {
            supplyPoint: true,
            product: true,
            brand: { include: { company: true } },
          },
        },
      },
    });

    if (!invoice) return new NextResponse('Not found', { status: 404 });

    const templateData = await buildInvoiceTemplateData(invoice);
    if (!invoice.invoiceNumber) {
      templateData.invoiceNumber = `PROFORMA-${invoice.id.substring(0, 6).toUpperCase()}`;
    }

    const element = React.createElement(InvoicePdfTemplate, { data: templateData }) as any;
    const pdfStream = await renderToStream(element);

    const pdfChunks: any[] = [];
    for await (const chunk of pdfStream) {
      pdfChunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(pdfChunks);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${templateData.invoiceNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating proforma pdf:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
