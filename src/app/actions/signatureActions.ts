'use server';

import React from 'react';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { renderToBuffer } from '@react-pdf/renderer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { uploadFileToR2 } from '@/lib/r2';
import {
  applyPadesCryptographicSeal,
  computeAuditChainHash,
  decryptSigningToken,
  encryptSigningToken,
  generateSecureSigningToken,
  generateSixDigitOtp,
  hashOtpCode,
  hashSigningToken,
  sha256BufferHex,
  verifyOtpCodeConstantTime,
  verifyUploadedClientSignedPdf,
} from '@/lib/signature/cryptoPades';
import {
  BrandDeliveryIdentity,
  getPublicAppBaseUrl,
  sendOtpCodeNotification,
  sendSignedDurableMediumEmail,
  sendSigningInvitationEmail,
  sendStep2ContractUnlockedEmail,
} from '@/lib/signature/deliveryService';
import {
  AuditCertificatePdfTemplate,
  AuditEventPdfItem,
} from '@/components/pdf/AuditCertificatePdfTemplate';
import {
  determineContractIsB2B,
  determineContractIsIndexed,
  fetchLogoAsDataUri,
  generateAndUploadContractBundle,
} from '@/lib/contracts/contractPdfService';
import { buildTemplateDataFromContract } from '@/lib/templateBuilder';

// ─── Helpers de Contexto HTTP y Auditoría Encadenada ─────────────────────────

async function extractRequestClientMeta(): Promise<{ ipAddress: string; userAgent: string }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip =
      (forwarded ? forwarded.split(',')[0].trim() : null) ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      '127.0.0.1';
    const ua = h.get('user-agent') || 'Desconocido';
    return { ipAddress: ip.slice(0, 100), userAgent: ua.slice(0, 500) };
  } catch {
    return { ipAddress: '127.0.0.1', userAgent: 'Servidor Interno ERP' };
  }
}

export async function appendSignatureAuditEvent(params: {
  envelopeId: string;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadataJson?: Record<string, any> | null;
}) {
  const lastEvent = await prisma.signatureAuditEvent.findFirst({
    where: { envelopeId: params.envelopeId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { eventHash: true, createdAt: true },
  });

  // Garantizamos monotonicidad estricta en ms para orden determinista en verificación pública
  const minNextMs = lastEvent ? lastEvent.createdAt.getTime() + 1 : 0;
  const now = new Date(Math.max(Date.now(), minNextMs));
  const tsIso = now.toISOString();

  const metaWithIso = {
    ...(params.metadataJson || {}),
    _tsIso: tsIso,
  };

  const eventHash = computeAuditChainHash({
    envelopeId: params.envelopeId,
    eventType: params.eventType,
    ipAddress: params.ipAddress || '',
    userAgent: params.userAgent || '',
    metadataJson: metaWithIso,
    prevEventHash: lastEvent?.eventHash || null,
    timestampIso: tsIso,
  });

  return prisma.signatureAuditEvent.create({
    data: {
      envelopeId: params.envelopeId,
      eventType: params.eventType,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      metadataJson: metaWithIso,
      prevEventHash: lastEvent?.eventHash || null,
      eventHash,
      createdAt: now,
    },
  });
}

function formatDateTimeMadrid(d?: Date | string | null): string {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const AUDIT_EVENT_LABELS: Record<string, string> = {
  ENVELOPE_CREATED: 'Sobre creado y sellado en origen (T0)',
  EMAIL_SUMMARY_SENT: 'Envío Resumen Precontractual RD 88/2026',
  ENVELOPE_RESENT: 'Reenvío de invitación al firmante',
  PORTAL_OPENED: 'Acceso del firmante al portal seguro',
  SUMMARY_VIEWED: 'Visualización Documento Resumen RD 88/2026',
  SUMMARY_ACCEPTED: 'Aceptación expresa Resumen Precontractual (T1)',
  STEP2_CONTRACT_EMAIL_SENT: 'Envío separado del Contrato (Paso 2)',
  CONTRACT_VIEWED: 'Revisión del Contrato completo',
  OTP_SENT: 'Código OTP de 6 dígitos enviado',
  OTP_FAILED: 'Intento fallido de código OTP',
  OTP_VERIFIED: 'Autenticación OTP verificada con éxito (T2)',
  QUALIFIED_CERT_UPLOADED: 'Certificado X.509 cualificado verificado (T2)',
  QUALIFIED_CERT_REJECTED: 'Rechazo de PDF con certificado inválido',
  PADES_SEALED: 'Sellado criptográfico PAdES + Marca Tiempo (T3)',
  DURABLE_MEDIUM_SENT: 'Copia sellada enviada en soporte duradero',
  ENVELOPE_CANCELLED: 'Sobre anulado por Backoffice / Comercial',
};

export async function getAuditEventHumanLabel(eventType: string): Promise<string> {
  return AUDIT_EVENT_LABELS[eventType] || eventType;
}

async function resolveBackofficeCaller() {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) return null;

  const sessionUser = session.user as any;
  const selectFields = { id: true, email: true, role: true, isActive: true, brandId: true, channelId: true };

  let dbUser = sessionUser.id
    ? await prisma.user.findUnique({ where: { id: sessionUser.id }, select: selectFields })
    : null;

  if (!dbUser && sessionUser.email) {
    dbUser = await prisma.user.findFirst({
      where: { email: { equals: String(sessionUser.email).trim(), mode: 'insensitive' } },
      select: selectFields,
    });
  }

  if (!dbUser || dbUser.isActive === false) return null;
  return dbUser;
}

function buildBrandIdentity(brand: any): BrandDeliveryIdentity {
  return {
    brandName: brand?.name || 'Comercializadora Eléctrica',
    companyName: brand?.company?.name || brand?.name || 'Comercializadora Eléctrica',
    companyCif: brand?.company?.cif || null,
    logoUrl: brand?.invoiceLogoUrl || brand?.logoUrl || null,
    accentColor: brand?.accentColor || '#14383b',
    supportEmail: brand?.supportEmail || null,
    phone: brand?.phone || null,
    freePhone900: brand?.freePhone900 || null,
    smsSenderId: brand?.smsSenderId || null,
  };
}

function extractContractSignerDetails(contract: any) {
  const cData: any =
    typeof contract.airtableData === 'string'
      ? (() => {
          try {
            return JSON.parse(contract.airtableData);
          } catch {
            return {};
          }
        })()
      : contract.airtableData || {};
  const leadData: any = contract.Lead?.contractData || {};

  const client = contract.client || {};
  const sp = contract.supplyPoint || {};

  const fullTitular =
    client.businessName ||
    [client.firstName, client.lastName, client.lastName2].filter(Boolean).join(' ').trim() ||
    contract.Lead?.businessName ||
    cData.businessName ||
    'Cliente';

  const vatNumber =
    client.vatNumber || contract.Lead?.vatNumber || cData.cif || cData.nif || leadData.cif || leadData.nif || '';

  const cnae = sp.cnae || client.cnae || cData.cnae || leadData.cnae || '';
  const isB2B = determineContractIsB2B(vatNumber, cnae);

  // Si es persona jurídica y consta representante firmante, usamos sus datos de firma manteniendo referencia al titular
  const repName =
    client.representativeName ||
    client.contactName ||
    cData['NOMBRE Y APELLIDOS'] ||
    cData['Nombre Contacto'] ||
    leadData.representativeName ||
    '';
  const repVat =
    client.representativeVat ||
    client.contactVat ||
    cData['NIF Contacto'] ||
    cData.Dni ||
    leadData.representativeVat ||
    '';

  const isJuridica = /^[ABCDEFGHJNPQRSUVW]/i.test(String(vatNumber).trim());
  const signerName = isJuridica && repName ? `${repName} (${fullTitular})` : fullTitular;
  const signerNif = (isJuridica && repVat ? repVat : vatNumber) || 'SIN-NIF';

  const signerEmail = (
    client.contactEmail ||
    client.email ||
    contract.Lead?.email ||
    cData.email ||
    cData.contactEmail ||
    leadData.email ||
    ''
  ).trim();

  const signerPhone = (
    client.contactPhone ||
    client.phone ||
    contract.Lead?.phone ||
    cData.phone ||
    cData.tlf_1 ||
    leadData.phone ||
    ''
  ).trim();

  const cups = sp.cups || contract.Lead?.cups || cData.cups || '';
  const tariff =
    sp.tariff ||
    contract.product?.tariff ||
    contract.Lead?.tariff ||
    (Array.isArray(cData.Tarifa) ? cData.Tarifa[0] : cData.tarifa || cData.Tarifa) ||
    '2.0TD';

  const supplyAddress = [
    sp.address || cData.direccion || cData['DOMICILIO PS'] || '',
    sp.postalCode || cData.cp || cData['CP PS'] || '',
    sp.city || cData.poblacion || cData['POBLACION PS'] || '',
    sp.province ? `(${sp.province})` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const allowedNifsOrCifs = Array.from(
    new Set(
      [
        vatNumber,
        repVat,
        signerNif,
        client.vatNumber,
        client.representativeVat,
        client.contactVat,
        contract.Lead?.vatNumber,
      ]
        .map((v) => String(v || '').trim())
        .filter((v) => v.length >= 6)
    )
  );

  return {
    cData,
    signerName,
    signerNif,
    signerEmail,
    signerPhone: signerPhone || null,
    vatNumber,
    cnae,
    isB2B,
    cups,
    tariff: String(tariff),
    supplyAddress,
    allowedNifsOrCifs,
  };
}

async function fetchPdfBufferFromUrl(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`No se pudo descargar el documento desde almacenamiento (${resp.status}).`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

// ─── 1. Acciones Backoffice / Comerciales (Protegidas por Sesión RBAC) ───────

export async function sendContractToSignatureAction(contractId: string): Promise<{
  success?: boolean;
  error?: string;
  envelopeCode?: string;
  signingUrl?: string;
  emailWarning?: string;
}> {
  try {
    const caller = await resolveBackofficeCaller();
    if (!caller || caller.role === 'CLIENT') {
      return { error: 'No tienes permisos para enviar contratos a firma digital.' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();

    const contract = await prisma.contract.findFirst({
      where: { AND: [visibilityFilter, { id: contractId }] },
      include: {
        Lead: true,
        client: { include: { brand: { include: { company: true } } } },
        supplyPoint: true,
        product: true,
        brand: { include: { company: true } },
      },
    });

    if (!contract) {
      return { error: 'Contrato no encontrado o sin permisos de acceso.' };
    }

    const brand =
      contract.brand ||
      contract.client?.brand ||
      (await prisma.brand.findFirst({ include: { company: true }, orderBy: { createdAt: 'asc' } }));

    if (!brand) {
      return { error: 'No existe marca comercial configurada para este contrato.' };
    }

    const details = extractContractSignerDetails(contract);
    if (!details.signerEmail) {
      return { error: 'El cliente no tiene una dirección de email registrada para recibir la firma.' };
    }

    // Asegurar que existan tanto el PDF del contrato/anexo como el Documento Resumen Precontractual RD 88/2026
    let contractPdfUrl = contract.pdfUrl;
    let summaryPdfUrl = contract.summaryPdfUrl;

    if (!contractPdfUrl || !summaryPdfUrl) {
      const isIndexed = determineContractIsIndexed({
        pricingModel: contract.pricingModel,
        productTypeSnapshot: contract.productTypeSnapshot,
        product: contract.product,
      });
      const templateData = buildTemplateDataFromContract(
        contract,
        details.cData,
        contract.product,
        details.isB2B
      );
      const generated = await generateAndUploadContractBundle({
        brandId: brand.id,
        templateVersionId: contract.templateVersionId,
        contractCode: contract.contractCode || contract.id,
        templateData,
        isB2B: details.isB2B,
        isTransferencia: Boolean(contract.transferencia),
        isIndexed,
        hasSelfConsumption: Boolean(contract.autoconsumo || contract.supplyPoint?.hasSelfConsumption),
        hasSolarWallet: Boolean(contract.bolsilloSolar),
      });

      if (!contractPdfUrl) contractPdfUrl = generated.contractPdfUrl;
      summaryPdfUrl = generated.summaryPdfUrl;

      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          pdfUrl: contractPdfUrl,
          summaryPdfUrl,
          templateVersionId: contract.templateVersionId || generated.templateVersionId,
        },
      });
    }

    const [contractBuffer, summaryBuffer] = await Promise.all([
      fetchPdfBufferFromUrl(contractPdfUrl),
      fetchPdfBufferFromUrl(summaryPdfUrl),
    ]);

    const contractHash = sha256BufferHex(contractBuffer);
    const summaryHash = sha256BufferHex(summaryBuffer);

    // Cancelar sobres abiertos previos de este mismo contrato
    await prisma.signatureEnvelope.updateMany({
      where: {
        contractId: contract.id,
        status: { in: ['SENT', 'VIEWED', 'SUMMARY_ACCEPTED', 'OTP_SENT'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Reemplazado por un nuevo envío a firma.',
      },
    });

    const rawToken = generateSecureSigningToken();
    const tokenHash = hashSigningToken(rawToken);
    const tokenEncrypted = encryptSigningToken(rawToken);

    const brandCode = (brand.codigoMarca || brand.slug || 'SIG')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);
    const year = new Date().getFullYear();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const envelopeCode = `SIG-${brandCode}-${year}-${randomSuffix}`;

    let documentKind = 'CONTRACT';
    if (contract.previousContractId && contract.tipo === 'M1') {
      const modType = String(details.cData?.modificationType || '').toUpperCase();
      documentKind = modType.includes('SUBROG') || modType.includes('TITULAR') ? 'SUBROGACION' : 'MODTEC';
    } else if (contract.tipo === 'R') {
      documentKind = 'RENEWAL';
    }

    const upperTariff = details.tariff.toUpperCase();
    const isHighTariff = ['3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD'].includes(upperTariff);
    const allowCertUploadFallback =
      Boolean(brand.allowQualifiedCertUploadB2B) && (details.isB2B || isHighTariff);

    const expirationDays = Math.max(1, Number(brand.envelopeExpirationDays || 14));
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 3600 * 1000);
    const flowMode = brand.signatureFlowMode || 'SEQUENTIAL_SINGLE_LINK';

    const envelope = await prisma.signatureEnvelope.create({
      data: {
        envelopeCode,
        contractId: contract.id,
        brandId: brand.id,
        documentKind,
        flowMode,
        tokenHash,
        signingTokenEncrypted: tokenEncrypted,
        status: 'SENT',
        signerName: details.signerName,
        signerNif: details.signerNif,
        signerEmail: details.signerEmail,
        signerPhone: details.signerPhone,
        isB2B: details.isB2B,
        tariff: details.tariff,
        summaryPdfDraftUrl: summaryPdfUrl,
        summaryPdfHashSha256: summaryHash,
        contractSentAt: flowMode === 'SEQUENTIAL_SINGLE_LINK' ? new Date() : null,
        contractPdfDraftUrl: contractPdfUrl,
        contractPdfHashSha256: contractHash,
        allowCertUploadFallback,
        expiresAt,
        createdByUserId: caller.id,
      },
    });

    const reqMeta = await extractRequestClientMeta();

    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'ENVELOPE_CREATED',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: {
        createdByEmail: caller.email,
        contractCode: contract.contractCode,
        summaryPdfHashSha256: summaryHash,
        contractPdfHashSha256: contractHash,
        flowMode,
        allowCertUploadFallback,
      },
    });

    const signingUrl = `${getPublicAppBaseUrl()}/firmar/${rawToken}`;
    const deliveryRes = await sendSigningInvitationEmail({
      brand: buildBrandIdentity(brand),
      signerName: details.signerName,
      signerNif: details.signerNif,
      signerEmail: details.signerEmail,
      signerPhone: details.signerPhone,
      contractCode: contract.contractCode || contract.id,
      cups: details.cups,
      supplyAddress: details.supplyAddress,
      tariff: details.tariff,
      signingUrl,
      flowMode,
      summaryPdfBuffer: summaryBuffer,
      expiresAt,
    });

    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'EMAIL_SUMMARY_SENT',
      ipAddress: reqMeta.ipAddress,
      userAgent: 'Motor Envío Transaccional ERP',
      metadataJson: {
        recipientEmail: details.signerEmail,
        recipientPhone: details.signerPhone,
        emailSent: deliveryRes.emailSent,
        smsSent: deliveryRes.smsSent,
      },
    });

    if (contract.status === 'BORRADOR') {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'VERIFICANDO_FIRMA' },
      });
    }

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${contract.id}`);

    const isInternalBackoffice = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(caller.role);

    return {
      success: true,
      envelopeCode,
      signingUrl: isInternalBackoffice ? signingUrl : undefined,
      emailWarning: deliveryRes.warning,
    };
  } catch (err: any) {
    console.error('[sendContractToSignatureAction ERROR]:', err);
    return { error: err?.message || 'Error inesperado al crear el sobre de firma digital.' };
  }
}

export async function resendSignatureEnvelopeAction(contractId: string): Promise<{
  success?: boolean;
  error?: string;
  signingUrl?: string;
  emailWarning?: string;
}> {
  try {
    const caller = await resolveBackofficeCaller();
    if (!caller || caller.role === 'CLIENT') {
      return { error: 'No autorizado.' };
    }

    const envelope = await prisma.signatureEnvelope.findFirst({
      where: {
        contractId,
        status: { in: ['SENT', 'VIEWED', 'SUMMARY_ACCEPTED', 'OTP_SENT'] },
      },
      include: {
        brand: { include: { company: true } },
        contract: { include: { client: true, supplyPoint: true, Lead: true, product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!envelope) {
      // Si no hay sobre activo, creamos uno nuevo limpiamente
      return sendContractToSignatureAction(contractId);
    }

    const rawToken = decryptSigningToken(envelope.signingTokenEncrypted);
    if (!rawToken) {
      return sendContractToSignatureAction(contractId);
    }

    const newExpiresAt = new Date(
      Date.now() + Math.max(1, Number(envelope.brand.envelopeExpirationDays || 14)) * 24 * 3600 * 1000
    );
    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: { expiresAt: newExpiresAt },
    });

    const summaryBuffer = await fetchPdfBufferFromUrl(envelope.summaryPdfDraftUrl);
    const details = extractContractSignerDetails(envelope.contract);
    const signingUrl = `${getPublicAppBaseUrl()}/firmar/${rawToken}`;

    const deliveryRes = await sendSigningInvitationEmail({
      brand: buildBrandIdentity(envelope.brand),
      signerName: envelope.signerName,
      signerNif: envelope.signerNif,
      signerEmail: envelope.signerEmail,
      signerPhone: envelope.signerPhone,
      contractCode: envelope.contract.contractCode || envelope.contractId,
      cups: details.cups,
      supplyAddress: details.supplyAddress,
      tariff: envelope.tariff || details.tariff,
      signingUrl,
      flowMode: envelope.flowMode,
      summaryPdfBuffer: summaryBuffer,
      expiresAt: newExpiresAt,
    });

    const reqMeta = await extractRequestClientMeta();
    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'ENVELOPE_RESENT',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: {
        resentByEmail: caller.email,
        recipientEmail: envelope.signerEmail,
        emailSent: deliveryRes.emailSent,
      },
    });

    const isInternalBackoffice = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(caller.role);

    revalidatePath(`/contratos/${contractId}`);
    return {
      success: true,
      signingUrl: isInternalBackoffice ? signingUrl : undefined,
      emailWarning: deliveryRes.warning,
    };
  } catch (err: any) {
    console.error('[resendSignatureEnvelopeAction ERROR]:', err);
    return { error: err?.message || 'Error al reenviar el sobre de firma.' };
  }
}

export async function getSignatureLinkForCopyAction(contractId: string): Promise<{
  success?: boolean;
  signingUrl?: string;
  envelopeCode?: string;
  error?: string;
}> {
  try {
    const caller = await resolveBackofficeCaller();
    if (!caller || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(caller.role)) {
      return { error: 'Solo Administración o Backoffice pueden copiar el enlace directo de firma.' };
    }

    const { getUserVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getUserVisibilityFilter();
    const visibleContract = await prisma.contract.findFirst({
      where: { AND: [visibilityFilter, { id: contractId }] },
      select: { id: true },
    });
    if (!visibleContract) {
      return { error: 'Contrato no encontrado o sin permisos.' };
    }

    const envelope = await prisma.signatureEnvelope.findFirst({
      where: {
        contractId,
        status: { in: ['SENT', 'VIEWED', 'SUMMARY_ACCEPTED', 'OTP_SENT'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!envelope) {
      return { error: 'No hay ningún sobre de firma pendiente activo para este contrato.' };
    }

    const rawToken = decryptSigningToken(envelope.signingTokenEncrypted);
    if (!rawToken) {
      return { error: 'No se pudo recuperar el enlace seguro. Reenvíe el contrato a firma para generar uno nuevo.' };
    }

    return {
      success: true,
      envelopeCode: envelope.envelopeCode,
      signingUrl: `${getPublicAppBaseUrl()}/firmar/${rawToken}`,
    };
  } catch (err: any) {
    return { error: err?.message || 'Error obteniendo enlace de firma.' };
  }
}

export async function cancelSignatureEnvelopeAction(
  contractId: string,
  reason?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await resolveBackofficeCaller();
    if (!caller || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(caller.role)) {
      return { error: 'Solo administración o Backoffice pueden anular un sobre en curso.' };
    }

    const openEnvelopes = await prisma.signatureEnvelope.findMany({
      where: {
        contractId,
        status: { in: ['SENT', 'VIEWED', 'SUMMARY_ACCEPTED', 'OTP_SENT'] },
      },
    });

    if (openEnvelopes.length === 0) {
      return { error: 'No hay sobres pendientes de firma para anular.' };
    }

    const reqMeta = await extractRequestClientMeta();
    const cancelReason = reason?.trim() || `Anulado manualmente por ${caller.email}`;

    for (const env of openEnvelopes) {
      await prisma.signatureEnvelope.update({
        where: { id: env.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason,
        },
      });
      await appendSignatureAuditEvent({
        envelopeId: env.id,
        eventType: 'ENVELOPE_CANCELLED',
        ipAddress: reqMeta.ipAddress,
        userAgent: reqMeta.userAgent,
        metadataJson: { cancelledBy: caller.email, reason: cancelReason },
      });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { status: true },
    });
    if (contract?.status === 'VERIFICANDO_FIRMA') {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'BORRADOR' },
      });
    }

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${contractId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error anulando sobre de firma.' };
  }
}

// ─── 2. Acciones Públicas del Portal de Firma (/firmar/[token]) ──────────────

async function findActiveOrSignedEnvelopeByToken(token: string) {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 16) return null;
  const tokenHash = hashSigningToken(clean);

  const envelope = await prisma.signatureEnvelope.findUnique({
    where: { tokenHash },
    include: {
      brand: { include: { company: true } },
      contract: {
        include: {
          client: true,
          supplyPoint: true,
          product: true,
          Lead: true,
        },
      },
      auditEvents: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!envelope) return null;

  // Auto-expirar si superó fecha límite y aún no estaba firmado ni cancelado
  if (
    ['SENT', 'VIEWED', 'SUMMARY_ACCEPTED', 'OTP_SENT'].includes(envelope.status) &&
    envelope.expiresAt.getTime() < Date.now()
  ) {
    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: { status: 'EXPIRED' },
    });
    envelope.status = 'EXPIRED';
  }

  return envelope;
}

function maskEmail(email: string): string {
  const [user, domain] = String(email || '').split('@');
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`;
}

function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\s+/g, '');
  if (clean.length < 5) return clean;
  return `${clean.slice(0, 3)} *** ${clean.slice(-3)}`;
}

export async function getPublicEnvelopeByTokenAction(token: string) {
  const envelope = await findActiveOrSignedEnvelopeByToken(token);
  if (!envelope) {
    return { found: false as const };
  }

  const reqMeta = await extractRequestClientMeta();

  // Registrar apertura inicial y visualización del Documento Resumen (T0 -> VIEWED)
  if (envelope.status === 'SENT' || !envelope.summaryViewedAt) {
    const now = new Date();
    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: envelope.status === 'SENT' ? 'VIEWED' : envelope.status,
        summaryViewedAt: envelope.summaryViewedAt || now,
      },
    });
    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'PORTAL_OPENED',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: { summaryViewed: true },
    });
  }

  const details = extractContractSignerDetails(envelope.contract);
  const company = envelope.brand.company;

  return {
    found: true as const,
    envelope: {
      envelopeCode: envelope.envelopeCode,
      status: envelope.status,
      documentKind: envelope.documentKind,
      flowMode: envelope.flowMode,
      signerName: envelope.signerName,
      signerNif: envelope.signerNif,
      maskedEmail: maskEmail(envelope.signerEmail),
      maskedPhone: maskPhone(envelope.signerPhone),
      hasPhone: Boolean(envelope.signerPhone),
      isB2B: envelope.isB2B,
      tariff: envelope.tariff || details.tariff,
      allowCertUploadFallback: envelope.allowCertUploadFallback,
      summaryAcceptedAt: envelope.summaryAcceptedAt ? envelope.summaryAcceptedAt.toISOString() : null,
      summaryPdfHashSha256: envelope.summaryPdfHashSha256,
      contractPdfHashSha256: envelope.contractPdfHashSha256,
      otpSent: Boolean(envelope.otpCodeHash && envelope.otpExpiresAt && envelope.otpExpiresAt.getTime() > Date.now()),
      otpChannel: envelope.otpChannel,
      expiresAt: envelope.expiresAt.toISOString(),
      signedAt: envelope.signedAt ? envelope.signedAt.toISOString() : null,
      signatureMethod: envelope.signatureMethod,
      verificationUrl: `${getPublicAppBaseUrl()}/verificar-firma/${envelope.envelopeCode}`,
      contractInfo: {
        contractCode: envelope.contract.contractCode || envelope.contractId,
        cups: details.cups,
        supplyAddress: details.supplyAddress,
        productName: envelope.contract.product?.name || details.cData?.producto || 'Suministro Eléctrico',
        ibanMasked: envelope.contract.iban
          ? `${envelope.contract.iban.slice(0, 4)} **** **** **** ${envelope.contract.iban.slice(-4)}`
          : null,
        isTransferencia: Boolean(envelope.contract.transferencia),
      },
      brand: {
        name: envelope.brand.name,
        logoUrl: envelope.brand.invoiceLogoUrl || envelope.brand.logoUrl || null,
        accentColor: envelope.brand.accentColor || '#14383b',
        supportEmail: envelope.brand.supportEmail || null,
        freePhone900: envelope.brand.freePhone900 || envelope.brand.phone || null,
        companyName: company?.name || envelope.brand.name,
        companyCif: company?.cif || '',
      },
    },
  };
}

// ─── T1: Aceptación Expresa Bloqueante del Documento Resumen (RD 88/2026) ────

export async function acceptPrecontractualSummaryAction(token: string): Promise<{
  success?: boolean;
  error?: string;
  acceptedAtIso?: string;
  step2EmailDispatched?: boolean;
}> {
  try {
    const envelope = await findActiveOrSignedEnvelopeByToken(token);
    if (!envelope) return { error: 'Enlace de firma no válido.' };
    if (envelope.status === 'SIGNED') return { error: 'Este documento ya ha sido firmado.' };
    if (envelope.status === 'CANCELLED' || envelope.status === 'EXPIRED') {
      return { error: 'Este enlace de firma ha expirado o ha sido anulado.' };
    }

    if (envelope.summaryAcceptedAt) {
      return {
        success: true,
        acceptedAtIso: envelope.summaryAcceptedAt.toISOString(),
      };
    }

    const reqMeta = await extractRequestClientMeta();
    const acceptedAt = new Date();

    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: 'SUMMARY_ACCEPTED',
        summaryViewedAt: envelope.summaryViewedAt || acceptedAt,
        summaryAcceptedAt: acceptedAt,
        summaryAcceptedIp: reqMeta.ipAddress,
        summaryAcceptedUserAgent: reqMeta.userAgent,
        contractSentAt: envelope.contractSentAt || acceptedAt,
      },
    });

    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'SUMMARY_ACCEPTED',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: {
        summaryPdfHashSha256: envelope.summaryPdfHashSha256,
        regulation: 'Real Decreto 88/2026',
      },
    });

    let step2EmailDispatched = false;
    if (envelope.flowMode === 'TWO_STEP_SEPARATE_DELIVERY') {
      const contractBuf = await fetchPdfBufferFromUrl(envelope.contractPdfDraftUrl);
      const details = extractContractSignerDetails(envelope.contract);
      const signingUrl = `${getPublicAppBaseUrl()}/firmar/${token.trim()}`;

      const step2Res = await sendStep2ContractUnlockedEmail({
        brand: buildBrandIdentity(envelope.brand),
        signerName: envelope.signerName,
        signerEmail: envelope.signerEmail,
        contractCode: envelope.contract.contractCode || envelope.contractId,
        cups: details.cups,
        signingUrl,
        contractPdfBuffer: contractBuf,
      });
      step2EmailDispatched = step2Res.emailSent;

      await appendSignatureAuditEvent({
        envelopeId: envelope.id,
        eventType: 'STEP2_CONTRACT_EMAIL_SENT',
        ipAddress: reqMeta.ipAddress,
        userAgent: 'Motor Envío Transaccional ERP',
        metadataJson: {
          recipientEmail: envelope.signerEmail,
          contractPdfHashSha256: envelope.contractPdfHashSha256,
          emailSent: step2Res.emailSent,
        },
      });
    }

    revalidatePath(`/contratos/${envelope.contractId}`);

    return {
      success: true,
      acceptedAtIso: acceptedAt.toISOString(),
      step2EmailDispatched,
    };
  } catch (err: any) {
    console.error('[acceptPrecontractualSummaryAction ERROR]:', err);
    return { error: err?.message || 'Error al registrar la aceptación del Documento Resumen.' };
  }
}

// ─── T2a: Solicitud de Código OTP de 6 dígitos (Exige T1 superado) ───────────

export async function requestSigningOtpAction(token: string): Promise<{
  success?: boolean;
  error?: string;
  channelUsed?: string;
  maskedEmail?: string;
  maskedPhone?: string | null;
}> {
  try {
    const envelope = await findActiveOrSignedEnvelopeByToken(token);
    if (!envelope) return { error: 'Enlace de firma no válido.' };
    if (envelope.status === 'SIGNED') return { error: 'Este contrato ya figura firmado.' };
    if (envelope.status === 'CANCELLED' || envelope.status === 'EXPIRED') {
      return { error: 'Este enlace de firma ya no está disponible.' };
    }

    if (!envelope.summaryAcceptedAt) {
      return {
        error:
          'Debe revisar y aceptar primero el Documento Resumen Precontractual (RD 88/2026) antes de solicitar el código de firma.',
      };
    }

    if (envelope.otpSendCount >= 6) {
      return {
        error:
          'Se ha alcanzado el límite máximo de envíos de códigos OTP para este sobre. Contacte con atención al cliente para recibir un nuevo enlace.',
      };
    }

    if (envelope.otpLastSentAt && Date.now() - envelope.otpLastSentAt.getTime() < 25_000) {
      return { error: 'Por favor, espere unos segundos antes de solicitar un nuevo código.' };
    }

    const otpCode = generateSixDigitOtp();
    const otpHash = hashOtpCode(envelope.id, otpCode);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const notifyRes = await sendOtpCodeNotification({
      brand: buildBrandIdentity(envelope.brand),
      signerName: envelope.signerName,
      signerEmail: envelope.signerEmail,
      signerPhone: envelope.signerPhone,
      contractCode: envelope.contract.contractCode || envelope.contractId,
      otpCode,
    });

    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: {
        status: 'OTP_SENT',
        otpChannel: notifyRes.channelUsed,
        otpCodeHash: otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        otpSendCount: { increment: 1 },
        otpLastSentAt: new Date(),
      },
    });

    const reqMeta = await extractRequestClientMeta();
    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'OTP_SENT',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: {
        channelUsed: notifyRes.channelUsed,
        smsSent: notifyRes.smsSent,
        emailSent: notifyRes.emailSent,
        sendCount: envelope.otpSendCount + 1,
      },
    });

    return {
      success: true,
      channelUsed: notifyRes.channelUsed,
      maskedEmail: maskEmail(envelope.signerEmail),
      maskedPhone: maskPhone(envelope.signerPhone),
    };
  } catch (err: any) {
    console.error('[requestSigningOtpAction ERROR]:', err);
    return { error: err?.message || 'Error al enviar el código de verificación OTP.' };
  }
}

// ─── Helper Interno Fase T3: Estampado Visual + Certificado + Sello PAdES ────

async function stampVisualSignatureOnPdf(params: {
  pdfBuffer: Buffer;
  bannerText: string;
  subText: string;
  rubricDataUrl?: string | null;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(params.pdfBuffer);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let embeddedPng: any = null;
  if (params.rubricDataUrl && params.rubricDataUrl.startsWith('data:image/png;base64,')) {
    try {
      const b64 = params.rubricDataUrl.replace('data:image/png;base64,', '');
      embeddedPng = await pdfDoc.embedPng(Buffer.from(b64, 'base64'));
    } catch {
      embeddedPng = null;
    }
  }

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  // Banda inferior de sello visual en la última página del documento contractual/resumen
  const boxX = 34;
  const boxY = 14;
  const boxW = width - 68;
  const boxH = 34;

  lastPage.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: rgb(0.96, 0.98, 0.99),
    borderColor: rgb(0.08, 0.22, 0.23),
    borderWidth: 0.8,
  });

  const textMaxWidth = embeddedPng ? boxW - 95 : boxW - 14;

  lastPage.drawText(params.bannerText.slice(0, 115), {
    x: boxX + 7,
    y: boxY + 20,
    size: 6.8,
    font: fontBold,
    color: rgb(0.06, 0.15, 0.25),
    maxWidth: textMaxWidth,
  });

  lastPage.drawText(params.subText.slice(0, 135), {
    x: boxX + 7,
    y: boxY + 8,
    size: 6.1,
    font: fontRegular,
    color: rgb(0.28, 0.33, 0.41),
    maxWidth: textMaxWidth,
  });

  if (embeddedPng) {
    const dims = embeddedPng.scaleToFit(76, 28);
    lastPage.drawImage(embeddedPng, {
      x: boxX + boxW - dims.width - 8,
      y: boxY + (boxH - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

async function mergePdfBuffers(firstPdf: Buffer, secondPdf: Buffer): Promise<Buffer> {
  const targetDoc = await PDFDocument.load(firstPdf);
  const appendixDoc = await PDFDocument.load(secondPdf);
  const copiedPages = await targetDoc.copyPages(appendixDoc, appendixDoc.getPageIndices());
  for (const page of copiedPages) {
    targetDoc.addPage(page);
  }
  return Buffer.from(await targetDoc.save());
}

async function finalizeEnvelopeAndContractT3(params: {
  envelope: any;
  signatureMethod: 'OTP_PADES' | 'QUALIFIED_CERT_UPLOAD';
  signedAt: Date;
  rubricDataUrl?: string | null;
  uploadedClientSignedPdfBuffer?: Buffer | null;
  certInfo?: {
    subjectDn?: string;
    issuerDn?: string;
    serialNumber?: string;
    matchedIdentifier?: string;
    validFrom?: Date;
    validTo?: Date;
  } | null;
}): Promise<{ verificationUrl: string; signedPdfUrl: string }> {
  const { envelope, signatureMethod, signedAt } = params;
  const details = extractContractSignerDetails(envelope.contract);
  const brand = envelope.brand;
  const companyName = brand.company?.name || brand.name;
  const companyCif = brand.company?.cif || 'SIN-CIF';
  const contractCode = envelope.contract.contractCode || envelope.contractId;
  const verificationUrl = `${getPublicAppBaseUrl()}/verificar-firma/${envelope.envelopeCode}`;

  const [qrCodeDataUri, brandLogoDataUri, summaryDraftBuffer, contractDraftBuffer] = await Promise.all([
    QRCode.toDataURL(verificationUrl, { margin: 1, width: 180 }).catch(() => null),
    fetchLogoAsDataUri(brand.invoiceLogoUrl || brand.logoUrl || null),
    fetchPdfBufferFromUrl(envelope.summaryPdfDraftUrl),
    fetchPdfBufferFromUrl(envelope.contractPdfDraftUrl),
  ]);

  // 1. Sellar Documento Resumen Precontractual aceptado en T1
  const stampedSummaryBuf = await stampVisualSignatureOnPdf({
    pdfBuffer: summaryDraftBuffer,
    bannerText: `DOCUMENTO RESUMEN PRECONTRACTUAL ACEPTADO EXPRESAMENTE (RD 88/2026) — ${envelope.signerName} (${envelope.signerNif})`,
    subText: `Aceptado el ${formatDateTimeMadrid(envelope.summaryAcceptedAt)} · IP ${envelope.summaryAcceptedIp || '-'} · Sobre ${envelope.envelopeCode}`,
  });

  const sealedSummary = await applyPadesCryptographicSeal({
    pdfBuffer: stampedSummaryBuf,
    companyName,
    companyCif,
    signerName: envelope.signerName,
    signerNif: envelope.signerNif,
    envelopeCode: `${envelope.envelopeCode}_RESUMEN`,
  });

  // 2. Obtener lista actualizada de eventos de auditoría para imprimirlos en el Certificado de Evidencias
  const freshAuditEvents = await prisma.signatureAuditEvent.findMany({
    where: { envelopeId: envelope.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const formattedAuditItems: AuditEventPdfItem[] = freshAuditEvents.map((ev) => {
    const meta: any = ev.metadataJson || {};
    let detail = '';
    if (ev.eventType === 'EMAIL_SUMMARY_SENT') detail = `Enviado a ${meta.recipientEmail || ''}`;
    else if (ev.eventType === 'SUMMARY_ACCEPTED') detail = 'Conformidad RD 88/2026';
    else if (ev.eventType === 'OTP_SENT') detail = `Canal: ${meta.channelUsed || 'EMAIL'}`;
    else if (ev.eventType === 'OTP_VERIFIED') detail = `OTP 6 dígitos validado`;
    else if (ev.eventType === 'QUALIFIED_CERT_UPLOADED') detail = `ID Cert: ${meta.matchedIdentifier || ''}`;
    else if (ev.eventType === 'ENVELOPE_CREATED') detail = `Modo: ${meta.flowMode || ''}`;

    return {
      eventType: ev.eventType,
      eventLabel: AUDIT_EVENT_LABELS[ev.eventType] || ev.eventType,
      timestampFormatted: formatDateTimeMadrid(ev.createdAt),
      ipAddress: ev.ipAddress,
      detailText: detail,
      eventHash: ev.eventHash,
    };
  });

  const docKindLabels: Record<string, string> = {
    CONTRACT: 'Alta / Contratación de Suministro',
    MODTEC: 'Anexo Modificación Técnica / Potencias',
    SUBROGACION: 'Anexo Cambio de Titular / Subrogación',
    RENEWAL: 'Renovación Contractual',
  };

  const rawAuditCertBuffer = Buffer.from(
    await renderToBuffer(
      React.createElement(AuditCertificatePdfTemplate, {
        envelopeCode: envelope.envelopeCode,
        verificationUrl,
        qrCodeDataUri,
        brandName: brand.name,
        companyName,
        companyCif,
        brandLogoDataUri,
        brandAccentColor: brand.accentColor,
        contractCode,
        cups: details.cups,
        tariff: envelope.tariff || details.tariff,
        supplyAddress: details.supplyAddress,
        documentKindLabel: docKindLabels[envelope.documentKind] || envelope.documentKind,
        flowModeLabel:
          envelope.flowMode === 'TWO_STEP_SEPARATE_DELIVERY'
            ? 'Doble Envío Separado (Resumen T1 -> Contrato T2)'
            : 'Secuencial Bloqueante en Dos Fases (T1 Resumen -> T2 Contrato)',
        signerName: envelope.signerName,
        signerNif: envelope.signerNif,
        signerEmail: envelope.signerEmail,
        signerPhone: envelope.signerPhone,
        isB2B: envelope.isB2B,
        summaryPdfHashSha256: envelope.summaryPdfHashSha256,
        summaryAcceptedAtFormatted: formatDateTimeMadrid(envelope.summaryAcceptedAt),
        summaryAcceptedIp: envelope.summaryAcceptedIp,
        contractPdfDraftHashSha256: envelope.contractPdfHashSha256,
        signatureMethod,
        signedAtFormatted: formatDateTimeMadrid(signedAt),
        otpChannel: envelope.otpChannel,
        otpVerifiedAtFormatted: formatDateTimeMadrid(signedAt),
        rubricDataUri: params.rubricDataUrl,
        certSubjectDn: params.certInfo?.subjectDn,
        certIssuerDn: params.certInfo?.issuerDn,
        certSerialNumber: params.certInfo?.serialNumber,
        certSignerNif: params.certInfo?.matchedIdentifier,
        uploadedSignedPdfHashSha256: params.uploadedClientSignedPdfBuffer
          ? sha256BufferHex(params.uploadedClientSignedPdfBuffer)
          : null,
        tsaProvider:
          process.env.QTSA_PROVIDER_NAME ||
          (process.env.QTSA_RFC3161_URL ? 'QTSA RFC 3161' : 'Sello Criptográfico ERP PAdES'),
        tsaTimestampFormatted: formatDateTimeMadrid(signedAt),
        auditEvents: formattedAuditItems,
      }) as any
    )
  );

  // Sellar criptográficamente el Certificado de Evidencias independiente
  const sealedStandaloneAuditCert = await applyPadesCryptographicSeal({
    pdfBuffer: rawAuditCertBuffer,
    companyName,
    companyCif,
    signerName: envelope.signerName,
    signerNif: envelope.signerNif,
    envelopeCode: `${envelope.envelopeCode}_AUDIT`,
  });

  let finalContractSignedBuffer: Buffer;
  let finalTsaResult = sealedStandaloneAuditCert.tsaResult;

  if (signatureMethod === 'OTP_PADES') {
    // Estampar rúbrica + anexar Certificado de Evidencias al final del contrato + aplicar sello PAdES único sobre todo el conjunto
    const visuallyStampedContract = await stampVisualSignatureOnPdf({
      pdfBuffer: contractDraftBuffer,
      bannerText: `FIRMADO ELECTRÓNICAMENTE POR ${envelope.signerName.toUpperCase()} (${envelope.signerNif})`,
      subText: `Fecha: ${formatDateTimeMadrid(signedAt)} · OTP (${envelope.otpChannel || 'EMAIL'}) · Sobre: ${envelope.envelopeCode} · Verificar en ${verificationUrl}`,
      rubricDataUrl: params.rubricDataUrl,
    });
    const combinedContractWithAudit = await mergePdfBuffers(visuallyStampedContract, rawAuditCertBuffer);
    const sealedContract = await applyPadesCryptographicSeal({
      pdfBuffer: combinedContractWithAudit,
      companyName,
      companyCif,
      signerName: envelope.signerName,
      signerNif: envelope.signerNif,
      envelopeCode: envelope.envelopeCode,
    });
    finalContractSignedBuffer = sealedContract.sealedPdfBuffer;
    finalTsaResult = sealedContract.tsaResult;
  } else {
    // En firma con Certificado Cualificado del cliente, preservamos intactos 100% los bytes del PDF firmado por el cliente (ByteRange FNMT/AutoFirma intacto en Adobe)
    finalContractSignedBuffer = params.uploadedClientSignedPdfBuffer!;
  }

  const safeCode = contractCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const [signedPdfUrl, signedSummaryPdfUrl, auditTrailPdfUrl] = await Promise.all([
    uploadFileToR2(
      `contracts/signed/Contrato_Firmado_${safeCode}_${envelope.envelopeCode}.pdf`,
      finalContractSignedBuffer,
      'application/pdf'
    ),
    uploadFileToR2(
      `contracts/signed/Resumen_Aceptado_${safeCode}_${envelope.envelopeCode}.pdf`,
      sealedSummary.sealedPdfBuffer,
      'application/pdf'
    ),
    uploadFileToR2(
      `contracts/signed/Certificado_Evidencias_${safeCode}_${envelope.envelopeCode}.pdf`,
      sealedStandaloneAuditCert.sealedPdfBuffer,
      'application/pdf'
    ),
  ]);

  const finalSignedHash = sha256BufferHex(finalContractSignedBuffer);

  await prisma.signatureEnvelope.update({
    where: { id: envelope.id },
    data: {
      status: 'SIGNED',
      signatureMethod,
      signedAt,
      otpVerifiedAt: signatureMethod === 'OTP_PADES' ? signedAt : null,
      certSubjectDn: params.certInfo?.subjectDn || null,
      certIssuerDn: params.certInfo?.issuerDn || null,
      certSerialNumber: params.certInfo?.serialNumber || null,
      certSignerNif: params.certInfo?.matchedIdentifier || null,
      certValidFrom: params.certInfo?.validFrom || null,
      certValidTo: params.certInfo?.validTo || null,
      signedPdfUrl,
      signedSummaryPdfUrl,
      auditTrailPdfUrl,
      signedPdfHashSha256: finalSignedHash,
      tsaProvider: finalTsaResult.tsaProvider,
      tsaTokenBase64: finalTsaResult.tsaTokenBase64,
      tsaTimestamp: finalTsaResult.tsaTimestamp,
    },
  });

  await appendSignatureAuditEvent({
    envelopeId: envelope.id,
    eventType: 'PADES_SEALED',
    ipAddress: 'Servidor Criptográfico ERP',
    userAgent: 'Motor PAdES PKCS#7 / RFC 3161',
    metadataJson: {
      signatureMethod,
      signedPdfHashSha256: finalSignedHash,
      tsaProvider: finalTsaResult.tsaProvider,
      tsaTimestamp: finalTsaResult.tsaTimestamp.toISOString(),
    },
  });

  // Actualizar Contrato, Mandato SEPA en SupplyPoint y Expediente Documental
  const isModificationAnnex = Boolean(envelope.contract.previousContractId && envelope.contract.tipo === 'M1');
  const preserveAdvancedStatus = ['TRAMITANDO', 'ACTIVO', 'FINALIZADO'].includes(envelope.contract.status);

  await prisma.contract.update({
    where: { id: envelope.contractId },
    data: {
      ...(preserveAdvancedStatus ? {} : { status: 'ACEPTADO' }),
      signatureDate: signedAt,
      ...(isModificationAnnex ? { fileAnexoFirmado: signedPdfUrl } : { filePdfSigned: signedPdfUrl }),
    },
  });

  if (envelope.contract.supplyPointId && !envelope.contract.transferencia) {
    await prisma.supplyPoint.update({
      where: { id: envelope.contract.supplyPointId },
      data: { mandateSigned: true },
    });
  }

  // Sincronizar estado Plan Amigo (PENDING_SIGNATURE -> PENDING_ACTIVATION + aviso email al Padrino)
  import('@/lib/services/ReferralEngine')
    .then(({ reconcileReferralsLifecycle }) =>
      reconcileReferralsLifecycle({ contractId: envelope.contractId })
    )
    .catch((err) => console.warn('[PLAN AMIGO] Error sincronizando tras firma PAdES:', err));

  // Registrar documentos en el expediente documental del contrato/cliente/CUPS
  await prisma.document.createMany({
    data: [
      {
        name: `Documento Resumen RD 88/2026 Aceptado (${envelope.envelopeCode}).pdf`,
        type: 'RESUMEN_PRECONTRACTUAL_FIRMADO',
        url: signedSummaryPdfUrl,
        sizeBytes: sealedSummary.sealedPdfBuffer.length,
        hash: sealedSummary.finalSha256,
        contractId: envelope.contractId,
        clientId: envelope.contract.clientId,
        supplyPointId: envelope.contract.supplyPointId,
      },
      {
        name: `Certificado Evidencias Firma (${envelope.envelopeCode}).pdf`,
        type: 'CERTIFICADO_EVIDENCIAS_FIRMA',
        url: auditTrailPdfUrl,
        sizeBytes: sealedStandaloneAuditCert.sealedPdfBuffer.length,
        hash: sealedStandaloneAuditCert.finalSha256,
        contractId: envelope.contractId,
        clientId: envelope.contract.clientId,
        supplyPointId: envelope.contract.supplyPointId,
      },
    ],
  });

  // Enviar copia sellada en soporte duradero al cliente (T3)
  const durableRes = await sendSignedDurableMediumEmail({
    brand: buildBrandIdentity(brand),
    signerName: envelope.signerName,
    signerEmail: envelope.signerEmail,
    contractCode,
    envelopeCode: envelope.envelopeCode,
    cups: details.cups,
    verificationUrl,
    signedContractBuffer: finalContractSignedBuffer,
    signedSummaryBuffer: sealedSummary.sealedPdfBuffer,
    standaloneAuditCertificateBuffer:
      signatureMethod === 'QUALIFIED_CERT_UPLOAD' ? sealedStandaloneAuditCert.sealedPdfBuffer : null,
  });

  await appendSignatureAuditEvent({
    envelopeId: envelope.id,
    eventType: 'DURABLE_MEDIUM_SENT',
    ipAddress: 'Servidor Envío Transaccional ERP',
    userAgent: 'Motor Soporte Duradero RD 88/2026',
    metadataJson: {
      recipientEmail: envelope.signerEmail,
      emailSent: durableRes.emailSent,
    },
  });

  revalidatePath('/contratos');
  revalidatePath(`/contratos/${envelope.contractId}`);

  return { verificationUrl, signedPdfUrl };
}

// ─── T2b (Vía Universal Principal): Completar Firma con OTP + Rúbrica ────────

export async function completeOtpSignatureAction(params: {
  token: string;
  otpCode: string;
  rubricDataUrl?: string | null;
  acceptedTermsAndSepa: boolean;
}): Promise<{
  success?: boolean;
  error?: string;
  verificationUrl?: string;
  envelopeCode?: string;
}> {
  try {
    if (!params.acceptedTermsAndSepa) {
      return { error: 'Debe marcar la casilla de conformidad contractual para finalizar la firma.' };
    }

    const envelope = await findActiveOrSignedEnvelopeByToken(params.token);
    if (!envelope) return { error: 'Enlace de firma no válido.' };
    if (envelope.status === 'SIGNED') return { error: 'Este contrato ya ha sido firmado.' };
    if (envelope.status === 'CANCELLED' || envelope.status === 'EXPIRED') {
      return { error: 'Este enlace de firma ha expirado o ha sido anulado.' };
    }

    if (!envelope.summaryAcceptedAt) {
      return {
        error: 'Debe aceptar primero el Documento Resumen Precontractual (Paso 1) antes de firmar el contrato.',
      };
    }

    if (!envelope.otpCodeHash || !envelope.otpExpiresAt) {
      return { error: 'Primero debe solicitar su código de verificación OTP de 6 dígitos.' };
    }

    if (envelope.otpExpiresAt.getTime() < Date.now()) {
      return { error: 'El código OTP ha caducado (validez 10 min). Solicite un nuevo código.' };
    }

    if (envelope.otpAttempts >= 5) {
      return { error: 'Demasiados intentos incorrectos. Solicite un nuevo código de verificación OTP.' };
    }

    const cleanCode = String(params.otpCode || '').replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      return { error: 'Introduzca los 6 dígitos del código de verificación.' };
    }

    const reqMeta = await extractRequestClientMeta();
    const isOtpValid = verifyOtpCodeConstantTime(envelope.id, cleanCode, envelope.otpCodeHash);

    if (!isOtpValid) {
      await prisma.signatureEnvelope.update({
        where: { id: envelope.id },
        data: { otpAttempts: { increment: 1 } },
      });
      await appendSignatureAuditEvent({
        envelopeId: envelope.id,
        eventType: 'OTP_FAILED',
        ipAddress: reqMeta.ipAddress,
        userAgent: reqMeta.userAgent,
        metadataJson: { attempt: envelope.otpAttempts + 1 },
      });
      return {
        error: `Código OTP incorrecto. Le quedan ${Math.max(0, 4 - envelope.otpAttempts)} intentos.`,
      };
    }

    const signedAt = new Date();
    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'OTP_VERIFIED',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: {
        channel: envelope.otpChannel,
        hasRubricGraphic: Boolean(params.rubricDataUrl),
      },
    });

    const result = await finalizeEnvelopeAndContractT3({
      envelope,
      signatureMethod: 'OTP_PADES',
      signedAt,
      rubricDataUrl: params.rubricDataUrl || null,
    });

    return {
      success: true,
      envelopeCode: envelope.envelopeCode,
      verificationUrl: result.verificationUrl,
    };
  } catch (err: any) {
    console.error('[completeOtpSignatureAction ERROR]:', err);
    return { error: err?.message || 'Error al procesar y sellar la firma digital.' };
  }
}

// ─── T2b Alt (Vía Secundaria Opcional B2B / 3.0TD / 6.1TD): Subir PDF X.509 ──

export async function completeQualifiedCertUploadSignatureAction(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  verificationUrl?: string;
  envelopeCode?: string;
  certSummary?: string;
}> {
  try {
    const token = String(formData.get('token') || '').trim();
    const file = formData.get('signedPdf') as File | null;

    if (!token || !file) {
      return { error: 'Debe adjuntar el archivo PDF firmado digitalmente con su certificado electrónico.' };
    }

    if (file.size > 20 * 1024 * 1024) {
      return { error: 'El archivo supera el tamaño máximo permitido (20 MB).' };
    }

    const envelope = await findActiveOrSignedEnvelopeByToken(token);
    if (!envelope) return { error: 'Enlace de firma no válido.' };
    if (envelope.status === 'SIGNED') return { error: 'Este contrato ya figura firmado.' };
    if (envelope.status === 'CANCELLED' || envelope.status === 'EXPIRED') {
      return { error: 'Este enlace de firma ha expirado o ha sido anulado.' };
    }

    if (!envelope.summaryAcceptedAt) {
      return {
        error:
          'Debe aceptar primero el Documento Resumen Precontractual (Paso 1) antes de aportar el contrato firmado.',
      };
    }

    if (!envelope.allowCertUploadFallback) {
      return {
        error: 'La modalidad de subida de certificado electrónico no está habilitada para este suministro.',
      };
    }

    const uploadedBuffer = Buffer.from(await file.arrayBuffer());
    const originalDraftBuffer = await fetchPdfBufferFromUrl(envelope.contractPdfDraftUrl);
    const details = extractContractSignerDetails(envelope.contract);
    const reqMeta = await extractRequestClientMeta();

    const verification = await verifyUploadedClientSignedPdf({
      uploadedPdfBuffer: uploadedBuffer,
      originalDraftBuffer,
      allowedNifsOrCifs: details.allowedNifsOrCifs,
    });

    if (!verification.valid) {
      await appendSignatureAuditEvent({
        envelopeId: envelope.id,
        eventType: 'QUALIFIED_CERT_REJECTED',
        ipAddress: reqMeta.ipAddress,
        userAgent: reqMeta.userAgent,
        metadataJson: {
          reason: verification.error,
          fileName: file.name,
        },
      });
      return { error: verification.error || 'El PDF aportado no contiene una firma criptográfica válida.' };
    }

    const signedAt = new Date();
    await appendSignatureAuditEvent({
      envelopeId: envelope.id,
      eventType: 'QUALIFIED_CERT_UPLOADED',
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent,
      metadataJson: {
        subjectDn: verification.subjectDn,
        issuerDn: verification.issuerDn,
        serialNumber: verification.serialNumber,
        matchedIdentifier: verification.matchedIdentifier,
        isIncrementalOverOriginal: verification.isIncrementalOverOriginal,
      },
    });

    const result = await finalizeEnvelopeAndContractT3({
      envelope,
      signatureMethod: 'QUALIFIED_CERT_UPLOAD',
      signedAt,
      uploadedClientSignedPdfBuffer: uploadedBuffer,
      certInfo: {
        subjectDn: verification.subjectDn,
        issuerDn: verification.issuerDn,
        serialNumber: verification.serialNumber,
        matchedIdentifier: verification.matchedIdentifier,
        validFrom: verification.validFrom,
        validTo: verification.validTo,
      },
    });

    return {
      success: true,
      envelopeCode: envelope.envelopeCode,
      verificationUrl: result.verificationUrl,
      certSummary: verification.subjectDn,
    };
  } catch (err: any) {
    console.error('[completeQualifiedCertUploadSignatureAction ERROR]:', err);
    return { error: err?.message || 'Error al verificar el certificado electrónico del PDF subido.' };
  }
}
