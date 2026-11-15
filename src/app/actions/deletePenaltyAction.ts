'use server';

import React from 'react';
import { revalidatePath } from 'next/cache';
import { renderToStream } from '@react-pdf/renderer';
import { toZonedTime } from 'date-fns-tz';
import { prisma } from '@/lib/prisma';
import { deleteFileFromR2, uploadFileToR2 } from '@/lib/r2';
import { MADRID_TZ, requirePenaltyAdminAccess, round2 } from '@/lib/bajasServer';
import {
  PenaltyInvoicePDF,
  PenaltyInvoicePDFData,
} from '@/components/pdf/PenaltyInvoicePDF';

/**
 * Emits a formal negative credit note (`AB-{invoiceNumber}`, `invoiceType = 'ABONO'`)
 * to nullify an already-issued or communicated penalty invoice while preserving accounting traceability.
 */
export async function issuePenaltyCreditNoteAction(id: string) {
  try {
    const { visibilityFilter } = await requirePenaltyAdminAccess();

    const invoice = await prisma.penaltyInvoice.findFirst({
      where: {
        id,
        contract: { ...visibilityFilter },
      },
      include: {
        client: true,
        supplyPoint: true,
        contract: {
          include: {
            brand: { include: { company: true } },
          },
        },
        rectifications: {
          select: { id: true, invoiceNumber: true },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada o sin permisos de acceso.' };
    }
    if (invoice.invoiceType === 'ABONO') {
      return { success: false, error: 'Este documento ya es una factura rectificativa (Abono).' };
    }
    if (invoice.rectifications && invoice.rectifications.length > 0) {
      return {
        success: false,
        error: `Esta factura ya ha sido anulada mediante el abono ${invoice.rectifications[0].invoiceNumber}.`,
      };
    }

    const brand = invoice.contract?.brand;
    if (!brand || !invoice.client || !invoice.supplyPoint) {
      return { success: false, error: 'Faltan datos de marca o titular para emitir el abono.' };
    }

    const now = new Date();
    const fullYear = now.getFullYear();
    const issueDateFormatted = toZonedTime(now, MADRID_TZ).toLocaleDateString('es-ES');
    const origIssueFormatted = toZonedTime(
      new Date(invoice.issueDate),
      MADRID_TZ
    ).toLocaleDateString('es-ES');

    const rawTotal = Math.abs(Number(invoice.amount || 0));
    const rawBase =
      invoice.baseAmount !== null && invoice.baseAmount !== undefined
        ? Math.abs(Number(invoice.baseAmount))
        : round2(rawTotal / 1.21);
    const rawTax =
      invoice.taxAmount !== null && invoice.taxAmount !== undefined
        ? Math.abs(Number(invoice.taxAmount))
        : round2(rawTotal - rawBase);

    const negBase = -round2(rawBase);
    const negTax = -round2(rawTax);
    const negTotal = -round2(rawTotal);

    let abonoNumber = `AB-${invoice.invoiceNumber}`;
    const existingAbono = await prisma.penaltyInvoice.findFirst({
      where: {
        invoiceNumber: abonoNumber,
        ...(invoice.companyId ? { companyId: invoice.companyId } : {}),
      },
      select: { id: true },
    });
    if (existingAbono) {
      abonoNumber = `AB-${invoice.invoiceNumber}-${Date.now().toString().slice(-3)}`;
    }

    const pdfData: PenaltyInvoicePDFData = {
      invoiceNumber: abonoNumber,
      issueDate: issueDateFormatted,
      baseAmount: negBase,
      taxAmount: negTax,
      totalAmount: negTotal,
      brandName: brand.company?.name || brand.name,
      brandVat: brand.company?.cif || '',
      brandAddress: brand.company?.address || brand.address || '',
      brandLogo: brand.invoiceLogoUrl || brand.logoUrl || null,
      clientName: invoice.client.businessName,
      clientVat: invoice.client.vatNumber,
      clientAddress: invoice.client.billingAddress || invoice.supplyPoint.address,
      clientCity: invoice.client.billingCity || invoice.supplyPoint.city,
      clientPostalCode: invoice.client.billingPostalCode || invoice.supplyPoint.postalCode,
      cups: invoice.supplyPoint.cups,
      contractCode: invoice.contract?.contractCode || null,
      isAbono: true,
      rectifiedInvoiceNumber: invoice.invoiceNumber,
      rectifiedIssueDate: origIssueFormatted,
    };

    const stream = await renderToStream(
      React.createElement(PenaltyInvoicePDF, { data: pdfData }) as any
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    const fileName = `penalizaciones/${fullYear}/${abonoNumber}.pdf`;
    const pdfUrl = await uploadFileToR2(fileName, pdfBuffer, 'application/pdf');

    await prisma.$transaction([
      prisma.penaltyInvoice.create({
        data: {
          invoiceNumber: abonoNumber,
          invoiceType: 'ABONO',
          baseAmount: negBase,
          taxAmount: negTax,
          amount: negTotal,
          issueDate: now,
          pdfUrl,
          companyId: invoice.companyId || brand.companyId || null,
          contractId: invoice.contractId,
          clientId: invoice.clientId,
          supplyPointId: invoice.supplyPointId,
          status: 'EMITIDA',
          paymentStatus: 'ANULADA',
          rectifiedPenaltyId: invoice.id,
        },
      }),
      prisma.penaltyInvoice.update({
        where: { id: invoice.id },
        data: {
          paymentStatus: 'ANULADA',
        },
      }),
      prisma.contract.update({
        where: { id: invoice.contractId },
        data: {
          penaltyStatus: 'PENDIENTE',
        },
      }),
    ]);

    revalidatePath('/facturas-penalizaciones');
    revalidatePath('/bajas');

    return {
      success: true,
      abonoNumber,
      message: `Emitida factura rectificativa ${abonoNumber} correctamente.`,
    };
  } catch (err: any) {
    console.error('Error issuing penalty credit note:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Deletes an uncommunicated penalty invoice (and its R2 PDF if not shared by another multipoint invoice)
 * and reverts the contract penalty status to `PENDIENTE`.
 * Communicated invoices require emitting a credit note (`issuePenaltyCreditNoteAction`) unless a `SUPERADMIN` forces deletion.
 */
export async function deletePenaltyInvoiceAction(
  id: string,
  forceDeleteCommunicated: boolean = false
) {
  try {
    const { role, visibilityFilter } = await requirePenaltyAdminAccess();

    const invoice = await prisma.penaltyInvoice.findFirst({
      where: {
        id,
        contract: { ...visibilityFilter },
      },
      include: {
        rectifications: { select: { id: true, invoiceNumber: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada o sin permisos de acceso.' };
    }

    if (invoice.rectifications && invoice.rectifications.length > 0) {
      return {
        success: false,
        error: `No se puede borrar físicamente porque tiene una factura rectificativa asociada (${invoice.rectifications[0].invoiceNumber}).`,
      };
    }

    if (invoice.status === 'COMUNICADA' && !(forceDeleteCommunicated && role === 'SUPERADMIN')) {
      return {
        success: false,
        error:
          'Esta factura ya fue comunicada al cliente. Por trazabilidad contable, emite una Factura Rectificativa (Abono).',
      };
    }

    // Check if another PenaltyInvoice shares the same pdfUrl (multipoint grouped PDF)
    let shouldDeleteR2 = Boolean(invoice.pdfUrl);
    if (invoice.pdfUrl) {
      const siblingCount = await prisma.penaltyInvoice.count({
        where: {
          id: { not: invoice.id },
          pdfUrl: invoice.pdfUrl,
        },
      });
      if (siblingCount > 0) {
        shouldDeleteR2 = false;
      }
    }

    await prisma.penaltyInvoice.delete({
      where: { id: invoice.id },
    });

    if (shouldDeleteR2 && invoice.pdfUrl) {
      await deleteFileFromR2(invoice.pdfUrl);
    }

    // Revert contract penaltyStatus to PENDIENTE only if no active PENALIZACION invoice remains
    const remainingActive = await prisma.penaltyInvoice.count({
      where: {
        contractId: invoice.contractId,
        invoiceType: 'PENALIZACION',
        paymentStatus: { not: 'ANULADA' },
      },
    });

    if (remainingActive === 0) {
      await prisma.contract.update({
        where: { id: invoice.contractId },
        data: { penaltyStatus: 'PENDIENTE' },
      });
    }

    revalidatePath('/facturas-penalizaciones');
    revalidatePath('/bajas');

    return { success: true };
  } catch (err: any) {
    console.error('Error deleting penalty invoice:', err);
    return { success: false, error: err.message };
  }
}
