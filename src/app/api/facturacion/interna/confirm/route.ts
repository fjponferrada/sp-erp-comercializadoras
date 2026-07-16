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
    const prefixNorm = `INT-${currentYear}-`;
    const prefixAbono = `AB-${currentYear}-`;

    // 1. Encontramos el último número de factura para cada prefijo
    const lastNorm = await prisma.internalInvoice.findFirst({
      where: { invoiceNumber: { startsWith: prefixNorm } },
      orderBy: { invoiceNumber: 'desc' }
    });

    const lastAbono = await prisma.internalInvoice.findFirst({
      where: { invoiceNumber: { startsWith: prefixAbono } },
      orderBy: { invoiceNumber: 'desc' }
    });

    let currentNormNumber = 0;
    if (lastNorm && lastNorm.invoiceNumber) {
      const parts = lastNorm.invoiceNumber.split('-');
      if (parts.length === 3) currentNormNumber = parseInt(parts[2], 10) || 0;
    }

    let currentAbonoNumber = 0;
    if (lastAbono && lastAbono.invoiceNumber) {
      const parts = lastAbono.invoiceNumber.split('-');
      if (parts.length === 3) currentAbonoNumber = parseInt(parts[2], 10) || 0;
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
            include: { supplyPoint: true, product: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const draft of draftsToConfirm) {
        let newInvoiceNumber = '';
        if (draft.totalAmount < 0) {
          currentAbonoNumber++;
          newInvoiceNumber = `${prefixAbono}${currentAbonoNumber.toString().padStart(4, '0')}`;
        } else {
          currentNormNumber++;
          newInvoiceNumber = `${prefixNorm}${currentNormNumber.toString().padStart(4, '0')}`;
        }
        
        const updated = await tx.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: 'EMITIDA',
            invoiceNumber: newInvoiceNumber,
            issueDate: new Date()
          },
          include: {
            client: true,
            contract: { include: { supplyPoint: true, product: true } }
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
          invoiceType: invoice.invoiceType,
          issueDate: invoice.issueDate,
          clientName: invoice.client?.businessName || 'Desconocido',
          clientNif: invoice.client?.vatNumber || 'S/N',
          clientAddress: invoice.client?.billingAddress || '',
          cups: invoice.contract?.supplyPoint?.cups || 'S/N',
          tariff: (() => {
            const airTarifa = (invoice.contract?.airtableData as any)?.Tarifa || (invoice.contract?.airtableData as any)?.tarifa;
            return (Array.isArray(airTarifa) ? airTarifa[0] : airTarifa) || invoice.contract?.product?.tariff || invoice.contract?.supplyPoint?.tariff || '';
          })(),
          contractedPower: invoice.contract?.p1c || invoice.contract?.supplyPoint?.p1c || '',
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
          maxExcedentes: (invoice.invoiceData as any)?.maxExcedentes || 0,
          bolsilloSolarLlenado: (invoice.invoiceData as any)?.bolsilloSolarLlenado || 0,
          f1Readings: (invoice.invoiceData as any)?.f1Readings || null,
          reactiveDetails: (invoice.invoiceData as any)?.reactiveDetails || [],
          svaCost: (invoice.invoiceData as any)?.svaCost || 0,
          svaConcept: (invoice.invoiceData as any)?.svaConcept || ''
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
