import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { uploadFileToR2 } from '@/lib/r2';
import { generateInvoiceXml } from '@/lib/templates/invoiceXmlTemplate';
import { InvoicePdfTemplate } from '@/components/pdf/InvoicePdfTemplate';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import {
  buildInvoiceTemplateData,
  isInternalBillingProductionEnabled,
} from '@/lib/services/internalInvoiceMapper';

function extractMaxSequence(rows: Array<{ invoiceNumber: string | null }>, prefix: string): number {
  let maxSeq = 0;
  for (const r of rows) {
    if (!r.invoiceNumber || !r.invoiceNumber.startsWith(prefix)) continue;
    const tail = r.invoiceNumber.slice(prefix.length);
    const num = parseInt(tail, 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }
  return maxSeq;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { draftIds } = body;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json({ message: 'draftIds is required' }, { status: 400 });
    }

    const currentYear = new Date().getFullYear().toString().slice(-2); // ej. '26'
    const prefixNorm = `INT-${currentYear}-`;
    const prefixAbono = `AB-${currentYear}-`;

    // 1. Procesamos la numeración correlativa por sociedad (companyId) en transacción
    const confirmedInvoices = await prisma.$transaction(async (tx) => {
      const results = [];

      const draftsToConfirm = await tx.internalInvoice.findMany({
        where: {
          id: { in: draftIds },
          status: 'BORRADOR',
        },
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
        orderBy: { createdAt: 'asc' },
      });

      // Cache de contadores correlativos por sociedad (companyId o '__GLOBAL__')
      const seqCounters = new Map<string, { norm: number; abono: number }>();

      for (const draft of draftsToConfirm) {
        const resolvedCompanyId =
          draft.companyId ||
          draft.contract?.brand?.companyId ||
          draft.client?.brand?.companyId ||
          null;
        const companyKey = resolvedCompanyId || '__GLOBAL__';

        let counters = seqCounters.get(companyKey);
        if (!counters) {
          const companyFilter = resolvedCompanyId ? { companyId: resolvedCompanyId } : { companyId: null };
          const [existingNorms, existingAbonos] = await Promise.all([
            tx.internalInvoice.findMany({
              where: { ...companyFilter, invoiceNumber: { startsWith: prefixNorm } },
              select: { invoiceNumber: true },
            }),
            tx.internalInvoice.findMany({
              where: { ...companyFilter, invoiceNumber: { startsWith: prefixAbono } },
              select: { invoiceNumber: true },
            }),
          ]);
          counters = {
            norm: extractMaxSequence(existingNorms, prefixNorm),
            abono: extractMaxSequence(existingAbonos, prefixAbono),
          };
          seqCounters.set(companyKey, counters);
        }

        const isAbono = draft.invoiceType === 'Abono' || draft.totalAmount < 0;
        let newInvoiceNumber = '';
        if (isAbono) {
          counters.abono += 1;
          newInvoiceNumber = `${prefixAbono}${counters.abono.toString().padStart(4, '0')}`;
        } else {
          counters.norm += 1;
          newInvoiceNumber = `${prefixNorm}${counters.norm.toString().padStart(4, '0')}`;
        }

        const updated = await tx.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: isAbono ? 'ABONO' : 'EMITIDA',
            companyId: resolvedCompanyId,
            invoiceNumber: newInvoiceNumber,
            issueDate: new Date(),
          },
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
        results.push(updated);
      }

      return results;
    });

    // 2. Fuera de la transacción de BD generamos y subimos PDFs y XMLs a R2
    for (const invoice of confirmedInvoices) {
      try {
        const templateData = await buildInvoiceTemplateData(invoice);
        const companyFolder = invoice.company?.cif || invoice.companyId || 'general';

        // Generar XML
        const xmlString = generateInvoiceXml(templateData);
        const xmlBuffer = Buffer.from(xmlString, 'utf-8');
        const xmlPath = `facturas/internas/${companyFolder}/20${currentYear}/${invoice.invoiceNumber}.xml`;
        const xmlUrl = await uploadFileToR2(xmlPath, xmlBuffer, 'application/xml');

        // Generar PDF
        const element = React.createElement(InvoicePdfTemplate, { data: templateData }) as any;
        const pdfStream = await renderToStream(element);
        const pdfChunks: any[] = [];
        for await (const chunk of pdfStream) {
          pdfChunks.push(chunk);
        }
        const pdfBuffer = Buffer.concat(pdfChunks);
        const pdfPath = `facturas/internas/${companyFolder}/20${currentYear}/${invoice.invoiceNumber}.pdf`;
        const pdfUrl = await uploadFileToR2(pdfPath, pdfBuffer, 'application/pdf');

        await prisma.internalInvoice.update({
          where: { id: invoice.id },
          data: { pdfUrl, xmlUrl },
        });

        // Fase 5 (Regla 171): SOLO promocionar a la tabla maestra `Invoice` cuando el motor interno
        // esté habilitado en producción (`ENABLE_INTERNAL_BILLING_PRODUCTION === 'true'`).
        // En Fase de Pruebas (conviviendo con Ingebau), todo queda 100% aislado en `InternalInvoice` (`/facturas-internas`).
        if (isInternalBillingProductionEnabled() && invoice.invoiceNumber) {
          const iData = ((invoice.invoiceData as Record<string, any>) || {});
          const sp = invoice.supplyPoint || invoice.contract?.supplyPoint || invoice.f1Invoice?.supplyPoint;
          const isInvAbono = invoice.status === 'ABONO' || invoice.invoiceType === 'Abono' || invoice.totalAmount < 0;

          const baseIeeVal =
            iData.baseIEE !== undefined ? Number(iData.baseIEE) : Number(invoice.subtotal1 || 0);
          const taxElectricVal =
            iData.taxElectric !== undefined ? Number(iData.taxElectric) : 0;
          const ieeRateVal =
            iData.ieeRate !== undefined ? Number(iData.ieeRate) : 5.11269632;
          // Regla 81: Invoice.totalMWh almacena la energía en kWh
          const totalKwh = Math.round(Number(invoice.totalMWh || 0) * 1000 * 1000) / 1000;

          let f1BaseVal =
            invoice.f1Invoice?.baseImponible !== null && invoice.f1Invoice?.baseImponible !== undefined
              ? Number(invoice.f1Invoice.baseImponible)
              : Number(iData.peajesDistribuidora || 0) +
                Number(iData.cargosDistribuidora || 0) +
                Number(iData.alquilerEquipo || 0);
          if (isInvAbono && f1BaseVal > 0) f1BaseVal = -f1BaseVal;
          if (!isInvAbono && f1BaseVal < 0) f1BaseVal = Math.abs(f1BaseVal);
          f1BaseVal = Math.round(f1BaseVal * 100) / 100;

          const mergedOfficialData = {
            ...iData,
            'Subtotal 1': baseIeeVal,
            'Importe Impuesto': taxElectricVal,
            'Impuesto (%)': ieeRateVal,
            'Energía Total Consumida': totalKwh,
            'Base Imponible IVA': Number(invoice.subtotal1 || 0),
            'Importe Bono Social': Number(iData.bonoSocial || 0),
            'BaseImponibleF1': f1BaseVal,
            'Importe SVA': Number(iData.svaCost || 0),
            'Tipo Factura': isInvAbono ? 'Abono' : (invoice.invoiceType || 'Normal'),
            'Tarifa': sp?.tariff || invoice.contract?.product?.tariff || '',
            'CP PS': sp?.postalCode || sp?.sipsPostalCode || '',
            'POBLACION PS': sp?.city || '',
            'PROVINCIA PS': sp?.province || '',
          };

          const officialPayload = {
            invoiceNumber: invoice.invoiceNumber,
            invoiceType: isInvAbono ? 'Abono' : (invoice.invoiceType || 'Normal'),
            clientId: invoice.clientId,
            companyId: invoice.companyId,
            contractId: invoice.contractId,
            supplyPointId: invoice.supplyPointId || sp?.id || null,
            f1InvoiceId: invoice.f1InvoiceId,
            issueDate: invoice.issueDate,
            billingStart: invoice.billingStart,
            billingEnd: invoice.billingEnd,
            subtotal1: baseIeeVal,
            taxPercentage: ieeRateVal,
            taxAmount: taxElectricVal,
            totalAmount: invoice.totalAmount,
            totalMWh: totalKwh,
            margin: invoice.margin,
            origin: 'INTERNAL_ENGINE',
            pdfUrl,
            xmlUrl,
            invoiceData: mergedOfficialData as any,
          };

          const existingOfficial = await prisma.invoice.findFirst({
            where: {
              invoiceNumber: invoice.invoiceNumber,
              companyId: invoice.companyId,
            },
            select: { id: true },
          });

          if (existingOfficial) {
            await prisma.invoice.update({
              where: { id: existingOfficial.id },
              data: officialPayload,
            });
          } else {
            await prisma.invoice.create({
              data: officialPayload,
            });
          }
        }
      } catch (genError) {
        console.error(
          `Error generando documentos para la factura ${invoice.invoiceNumber}:`,
          genError
        );
      }
    }

    return NextResponse.json({ success: true, count: confirmedInvoices.length });
  } catch (error: any) {
    console.error('Error confirming internal invoices:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
