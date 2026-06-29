import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { uploadFileToR2 } from '@/lib/r2';
import { generateInvoiceXml } from '@/lib/templates/invoiceXmlTemplate';
import { InvoicePdfTemplate } from '@/components/pdf/InvoicePdfTemplate';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { draftIds } = body;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json({ message: 'draftIds is required' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear().toString().slice(-2); // '26'
    const prefix = `INT-${currentYear}-`;

    // 1. Encontramos el último número de factura para este prefijo
    const lastInvoice = await prisma.internalInvoice.findFirst({
      where: {
        invoiceNumber: { startsWith: prefix }
      },
      orderBy: { invoiceNumber: 'desc' }
    });

    let currentNumber = 0;
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length === 3) {
        currentNumber = parseInt(parts[2], 10);
      }
    }

    // 2. Procesamos en transacción para asegurar la correlatividad
    const confirmedInvoices = await prisma.$transaction(async (tx) => {
      const results = [];
      
      const draftsToConfirm = await tx.internalInvoice.findMany({
        where: { 
          id: { in: draftIds },
          status: 'BORRADOR'
        },
        include: {
          client: true,
          contract: {
            include: { supplyPoint: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const draft of draftsToConfirm) {
        currentNumber++;
        const newInvoiceNumber = `${prefix}${currentNumber.toString().padStart(4, '0')}`; // INT-26-0001
        
        const updated = await tx.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: 'EMITIDA',
            invoiceNumber: newInvoiceNumber,
            issueDate: new Date()
          },
          include: {
            client: true,
            contract: { include: { supplyPoint: true } }
          }
        });
        results.push(updated);
      }
      return results;
    });

    // 3. Fuera de la transacción de DB, generamos y subimos los PDFs y XMLs para no bloquear la BD
    for (const invoice of confirmedInvoices) {
      try {
        const templateData = {
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          clientName: invoice.client?.businessName || 'Desconocido',
          clientNif: invoice.client?.vatNumber || 'S/N',
          cups: invoice.contract?.supplyPoint?.cups || 'S/N',
          billingStart: invoice.billingStart,
          billingEnd: invoice.billingEnd,
          totalMWh: invoice.totalMWh,
          subtotal1: invoice.subtotal1,
          taxPercentage: invoice.taxPercentage,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount
        };

        // Generar XML
        const xmlString = generateInvoiceXml(templateData);
        const xmlBuffer = Buffer.from(xmlString, 'utf-8');
        const xmlPath = `facturas/internas/20${currentYear}/${invoice.invoiceNumber}.xml`;
        const xmlUrl = await uploadFileToR2(xmlPath, xmlBuffer, 'application/xml');

        // Generar PDF
        const element = React.createElement(InvoicePdfTemplate, { data: templateData }) as any;
        const pdfStream = await renderToStream(element);
        const pdfChunks: any[] = [];
        for await (const chunk of pdfStream) {
          pdfChunks.push(chunk);
        }
        const pdfBuffer = Buffer.concat(pdfChunks);
        const pdfPath = `facturas/internas/20${currentYear}/${invoice.invoiceNumber}.pdf`;
        const pdfUrl = await uploadFileToR2(pdfPath, pdfBuffer, 'application/pdf');

        // Actualizar base de datos con URLs
        await prisma.internalInvoice.update({
          where: { id: invoice.id },
          data: { pdfUrl, xmlUrl }
        });

      } catch (genError) {
        console.error(`Error generando documentos para la factura ${invoice.invoiceNumber}:`, genError);
        // Continuamos con la siguiente factura aunque esta falle la generación de PDF
      }
    }

    return NextResponse.json({ success: true, count: confirmedInvoices.length });
  } catch (error: any) {
    console.error('Error confirming internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
