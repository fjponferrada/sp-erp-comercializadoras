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
  buildOfficialInvoicePayloadFromInternal,
  isInternalBillingProductionEnabled,
} from '@/lib/services/internalInvoiceMapper';
import {
  expireOverdueClientCreditsIfAny,
  reconcileReferralsLifecycle,
  recordWalletTransactionAtomic,
} from '@/lib/services/ReferralEngine';

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
    const isProdBilling = isInternalBillingProductionEnabled();

    // Regla 171 / Regla 263: SOLO mutar el monedero real de clientes cuando el motor interno esté activo en producción.
    // En Fase de Pruebas (Shadow Billing junto a Ingebau), las facturas internas conservan su simulación visual
    // sin consumir ni alterar jamás el saldo real de `ReferralWalletTransaction`.
    if (isProdBilling) {
      const preDrafts = await prisma.internalInvoice.findMany({
        where: { id: { in: draftIds }, status: 'BORRADOR' },
        select: {
          clientId: true,
          invoiceData: true,
          client: { select: { brandId: true } },
          contract: { select: { clientId: true, brandId: true } },
          supplyPoint: { select: { clientId: true } },
        },
      });
      const checkedClientBrands = new Set<string>();
      for (const pd of preDrafts) {
        const cId = pd.clientId || pd.contract?.clientId || pd.supplyPoint?.clientId;
        const bId = pd.contract?.brandId || pd.client?.brandId;
        if (cId && bId && !checkedClientBrands.has(`${cId}:${bId}`)) {
          checkedClientBrands.add(`${cId}:${bId}`);
          await expireOverdueClientCreditsIfAny(cId, bId).catch(() => null);
        }
      }
    }

    // 1. Procesamos la numeración correlativa por sociedad (companyId) y monedero Plan Amigo en transacción
    const confirmedInvoices = await prisma.$transaction(async (tx) => {
      const results = [];

      const rawDraftsToConfirm = await tx.internalInvoice.findMany({
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
              user: { select: { name: true } },
              brand: { include: { company: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Garantizar que cualquier Abono (AR/A/S) se confirme SIEMPRE antes que su Rectificadora (R) o facturas de cargo,
      // de modo que el saldo Plan Amigo restituido por el Abono quede disponible en el acto para la Rectificadora.
      const draftsToConfirm = [...rawDraftsToConfirm].sort((a, b) => {
        const aIsAbono = a.invoiceType === 'Abono' || a.totalAmount < 0 ? 0 : 1;
        const bIsAbono = b.invoiceType === 'Abono' || b.totalAmount < 0 ? 0 : 1;
        if (aIsAbono !== bIsAbono) return aIsAbono - bIsAbono;
        return a.createdAt.getTime() - b.createdAt.getTime();
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

        const idata = ((draft.invoiceData as Record<string, any>) || {});
        const resolvedClientId =
          draft.clientId || draft.contract?.clientId || draft.supplyPoint?.clientId || null;
        const resolvedBrandId =
          draft.contract?.brandId || draft.client?.brandId || null;

        let nextTotalAmount = draft.totalAmount;
        let nextInvoiceData: Record<string, any> | undefined = undefined;

        if (isProdBilling && !isAbono && resolvedClientId && resolvedBrandId) {
          const totalSinDto = Number(
            idata.totalSinDescuentoBolsillo ??
              Number(draft.subtotal1 || 0) +
                Number(draft.taxAmount || 0) +
                Number(idata.conceptosRepercutiblesExempt || 0)
          );
          const bsUso = Math.max(0, Number(idata.bolsilloSolarUso || 0));
          const totalTrasBolsillo = Math.max(0, Math.round((totalSinDto - bsUso) * 100) / 100);

          let plannedPlanAmigoUso = Math.max(
            0,
            Math.round(Number(idata.planAmigoUso || 0) * 100) / 100
          );

          // Si es una Rectificadora y acaba de recibir restitución de su Abono en este mismo lote, aprovechar saldo disponible
          if (plannedPlanAmigoUso === 0 && draft.invoiceType === 'Rectificadora' && totalTrasBolsillo > 0) {
            const balRows = await tx.$queryRawUnsafe<Array<{ bal: number | null }>>(
              `SELECT COALESCE(SUM("amountEur"), 0)::float8 AS bal
               FROM "ReferralWalletTransaction"
               WHERE "clientId" = $1 AND "brandId" = $2`,
              resolvedClientId,
              resolvedBrandId
            );
            const liveBal = Math.max(0, Math.round(Number(balRows?.[0]?.bal || 0) * 100) / 100);
            if (liveBal > 0) {
              plannedPlanAmigoUso = Math.min(liveBal, totalTrasBolsillo);
            }
          }

          if (plannedPlanAmigoUso > 0) {
            const existingRedemption = await tx.referralWalletTransaction.findFirst({
              where: { internalInvoiceId: draft.id, type: 'INVOICE_REDEMPTION' },
              select: { id: true },
            });
            if (!existingRedemption) {
              const redemptionTx = await recordWalletTransactionAtomic(tx, {
                brandId: resolvedBrandId,
                clientId: resolvedClientId,
                type: 'INVOICE_REDEMPTION',
                amountEur: -plannedPlanAmigoUso,
                internalInvoiceId: draft.id,
                notes: `Descuento Plan Amigo aplicado en factura ${newInvoiceNumber}`,
              });
              const actualUso = redemptionTx ? Math.abs(redemptionTx.amountEur) : 0;
              const saldoFinalAfter = redemptionTx ? redemptionTx.balanceAfterEur : 0;
              const saldoInicialBefore = Math.round((saldoFinalAfter + actualUso) * 100) / 100;

              nextTotalAmount = Math.max(
                0,
                Math.round((totalTrasBolsillo - actualUso) * 100) / 100
              );
              nextInvoiceData = {
                ...idata,
                hasPlanAmigo: actualUso > 0 || saldoInicialBefore > 0,
                planAmigoSaldoInicial: saldoInicialBefore,
                planAmigoUso: actualUso,
                planAmigoSaldoFinal: saldoFinalAfter,
              };
            }
          }
        } else if (isProdBilling && isAbono && resolvedClientId && resolvedBrandId) {
          const reversedPlanAmigo = Math.abs(
            Math.round(Number(idata.planAmigoUso ?? idata['Descuento Plan Amigo'] ?? 0) * 100) / 100
          );
          if (reversedPlanAmigo > 0) {
            const existingReversal = await tx.referralWalletTransaction.findFirst({
              where: { internalInvoiceId: draft.id, type: 'INVOICE_REVERSAL' },
              select: { id: true },
            });
            if (!existingReversal) {
              const reversalTx = await recordWalletTransactionAtomic(tx, {
                brandId: resolvedBrandId,
                clientId: resolvedClientId,
                type: 'INVOICE_REVERSAL',
                amountEur: reversedPlanAmigo,
                internalInvoiceId: draft.id,
                notes: `Restitución saldo Plan Amigo por factura rectificativa/abono ${newInvoiceNumber}`,
              });
              if (reversalTx) {
                const saldoBeforeReversal = Math.max(
                  0,
                  Math.round((reversalTx.balanceAfterEur - reversedPlanAmigo) * 100) / 100
                );
                nextInvoiceData = {
                  ...idata,
                  hasPlanAmigo: true,
                  planAmigoSaldoInicial: saldoBeforeReversal,
                  planAmigoSaldoFinal: reversalTx.balanceAfterEur,
                };
              }
            }
          }
        }

        const updated = await tx.internalInvoice.update({
          where: { id: draft.id },
          data: {
            status: isAbono ? 'ABONO' : 'EMITIDA',
            companyId: resolvedCompanyId,
            invoiceNumber: newInvoiceNumber,
            issueDate: new Date(),
            totalAmount: nextTotalAmount,
            ...(nextInvoiceData ? { invoiceData: nextInvoiceData as any } : {}),
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
                user: { select: { name: true } },
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
    // y construimos el diccionario canónico 100% compatible con Ingebau
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

        const { canonicalData, officialPayload } = await buildOfficialInvoicePayloadFromInternal({
          invoice,
          templateData,
          pdfUrl,
          xmlUrl,
        });

        await prisma.internalInvoice.update({
          where: { id: invoice.id },
          data: {
            pdfUrl,
            xmlUrl,
            invoiceData: canonicalData as any,
          },
        });

        // Fase 5 (Regla 171): SOLO promocionar a la tabla maestra `Invoice` cuando el motor interno
        // esté habilitado en producción (`ENABLE_INTERNAL_BILLING_PRODUCTION === 'true'`).
        // En Fase de Pruebas (conviviendo con Ingebau), todo queda 100% aislado en `InternalInvoice` (`/facturas-internas`).
        if (isInternalBillingProductionEnabled() && invoice.invoiceNumber) {
          const existingOfficial = await prisma.invoice.findFirst({
            where: {
              invoiceNumber: invoice.invoiceNumber,
              companyId: invoice.companyId,
            },
            select: { id: true },
          });

          let officialRecordId: string | null = null;
          if (existingOfficial) {
            const upOff = await prisma.invoice.update({
              where: { id: existingOfficial.id },
              data: officialPayload,
              select: { id: true },
            });
            officialRecordId = upOff.id;
          } else {
            const crOff = await prisma.invoice.create({
              data: officialPayload,
              select: { id: true },
            });
            officialRecordId = crOff.id;
          }

          if (officialRecordId) {
            await prisma.referralWalletTransaction
              .updateMany({
                where: { internalInvoiceId: invoice.id, invoiceId: null },
                data: { invoiceId: officialRecordId },
              })
              .catch(() => null);
          }
        }

        if (isProdBilling && invoice.status === 'EMITIDA' && invoice.contractId) {
          await reconcileReferralsLifecycle({ contractId: invoice.contractId }).catch((err) =>
            console.warn('[PLAN AMIGO] Error verificando hito 1ª factura:', err)
          );
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
