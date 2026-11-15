import React from 'react';
import { createHash } from 'crypto';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { uploadFileToR2 } from '@/lib/r2';
import {
  AnnexAutoconsumoConfig,
  BrandTemplatePayload,
  ContractClauseItem,
  DEFAULT_ANNEX_AUTOCONSUMO,
  DEFAULT_CLAUSES,
  DEFAULT_PARTICULAR_CONFIG,
  DEFAULT_SEPA_MANDATE_CONFIG,
  DEFAULT_SUMMARY_CONFIG,
  ParticularConditionsConfig,
  SepaMandateConfig,
  SummaryDocumentConfig,
  buildBrandVariableContext,
  getDefaultBrandTemplatePayload,
} from './defaultClauses';
import { ContractPdfTemplate, SignatureStampInfo } from '@/components/pdf/ContractPdfTemplate';
import { SummaryPdfTemplate } from '@/components/pdf/SummaryPdfTemplate';
import { ContractModPdfTemplate } from '@/components/pdf/ContractModPdfTemplate';

const logoDataUriCache = new Map<string, { dataUri: string; expiresAt: number }>();

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function determineContractIsB2B(vatNumber?: string | null, cnae?: string | null): boolean {
  const cleanVat = String(vatNumber || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s]/g, '');
  const isPersonaFisica = /^[0-9XYZ]/.test(cleanVat) && cleanVat.length === 9;
  const cleanCnae = String(cnae || '').trim();
  const isCore = isPersonaFisica && (cleanCnae === '9820' || cleanCnae === '9821');
  return !isCore;
}

export function determineContractIsIndexed(contractOrProduct?: any): boolean {
  const pm = String(contractOrProduct?.pricingModel || contractOrProduct?.product?.pricingModel || '').toUpperCase();
  const pt = String(
    contractOrProduct?.productTypeSnapshot ||
      contractOrProduct?.type ||
      contractOrProduct?.product?.type ||
      ''
  ).toUpperCase();
  const pn = String(contractOrProduct?.name || contractOrProduct?.product?.name || '').toUpperCase();
  if (pm === 'INDEXED' || pm === 'INDEXADO' || pm === 'INDEX') return true;
  if (pt.includes('INDEX') || pt.includes('PASS') || pn.includes('INDEX')) return true;
  return false;
}

export async function fetchLogoAsDataUri(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  const cached = logoDataUriCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dataUri;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentTypeHeader = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;

    // Detect PNG or JPEG magic bytes safely
    let mime = 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      mime = 'image/jpeg';
    } else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      mime = 'image/png';
    } else if (contentTypeHeader.includes('jpeg') || contentTypeHeader.includes('jpg')) {
      mime = 'image/jpeg';
    } else if (contentTypeHeader.includes('png')) {
      mime = 'image/png';
    } else {
      // Unsupported format for @react-pdf/renderer (e.g. webp/svg)
      return null;
    }

    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    logoDataUriCache.set(url, { dataUri, expiresAt: Date.now() + 30 * 60 * 1000 });
    return dataUri;
  } catch {
    return null;
  }
}

export function normalizeTemplatePayload(versionRecord: any): BrandTemplatePayload {
  return {
    particularConfig: {
      ...DEFAULT_PARTICULAR_CONFIG,
      ...((versionRecord?.particularConfigJson as Partial<ParticularConditionsConfig>) || {}),
    },
    clauses: Array.isArray(versionRecord?.clausesJson)
      ? (versionRecord.clausesJson as ContractClauseItem[])
      : DEFAULT_CLAUSES.map((c) => ({ ...c })),
    annexAutoconsumo: {
      ...DEFAULT_ANNEX_AUTOCONSUMO,
      ...((versionRecord?.annexAutoconsumoJson as Partial<AnnexAutoconsumoConfig>) || {}),
    },
    sepaMandateConfig: {
      ...DEFAULT_SEPA_MANDATE_CONFIG,
      ...((versionRecord?.sepaMandateConfigJson as Partial<SepaMandateConfig>) || {}),
    },
    summaryConfig: {
      ...DEFAULT_SUMMARY_CONFIG,
      ...((versionRecord?.summaryConfigJson as Partial<SummaryDocumentConfig>) || {}),
    },
  };
}

export async function resolveBrandAndActiveTemplate(brandId?: string | null, specificVersionId?: string | null) {
  let brand = brandId
    ? await prisma.brand.findUnique({ where: { id: brandId }, include: { company: true } })
    : null;

  if (!brand) {
    brand = await prisma.brand.findFirst({ include: { company: true }, orderBy: { createdAt: 'asc' } });
  }
  if (!brand) {
    throw new Error('No existe ninguna marca comercial configurada en el ERP.');
  }

  let versionRecord = specificVersionId
    ? await prisma.contractTemplateVersion.findUnique({ where: { id: specificVersionId } })
    : null;

  if (!versionRecord) {
    versionRecord = await prisma.contractTemplateVersion.findFirst({
      where: { brandId: brand.id, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    });
  }

  if (!versionRecord) {
    const defaultPayload = getDefaultBrandTemplatePayload();
    const maxRow = await prisma.contractTemplateVersion.findFirst({
      where: { brandId: brand.id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVer = (maxRow?.versionNumber ?? 0) + 1;
    versionRecord = await prisma.contractTemplateVersion.create({
      data: {
        brandId: brand.id,
        versionNumber: nextVer,
        status: 'PUBLISHED',
        name: `Condiciones Oficiales ${brand.name} v${nextVer}`,
        notes: 'Autoinicializada con cláusulas modulares base.',
        particularConfigJson: defaultPayload.particularConfig as any,
        clausesJson: defaultPayload.clauses as any,
        annexAutoconsumoJson: defaultPayload.annexAutoconsumo as any,
        sepaMandateConfigJson: defaultPayload.sepaMandateConfig as any,
        summaryConfigJson: defaultPayload.summaryConfig as any,
        publishedAt: new Date(),
      },
    });
  }

  const payload = normalizeTemplatePayload(versionRecord);
  const brandCtx = buildBrandVariableContext(brand, brand.company);
  const logoUrl = brand.invoiceLogoUrl || brand.logoUrl || null;
  const brandLogoDataUri = await fetchLogoAsDataUri(logoUrl);

  const bankAccounts: Array<{ bankName: string; iban: string }> = [];
  if (brand.bankIban1) bankAccounts.push({ bankName: brand.bankName1 || 'Cuenta 1', iban: brand.bankIban1 });
  if (brand.bankIban2) bankAccounts.push({ bankName: brand.bankName2 || 'Cuenta 2', iban: brand.bankIban2 });
  if (brand.bankIban3) bankAccounts.push({ bankName: brand.bankName3 || 'Cuenta 3', iban: brand.bankIban3 });

  return {
    brand,
    company: brand.company,
    versionRecord,
    payload,
    brandCtx,
    brandLogoDataUri,
    bankAccounts,
  };
}

export interface RenderContractBundleOptions {
  brandId?: string | null;
  templateVersionId?: string | null;
  customPayloadOverride?: BrandTemplatePayload | null;
  templateData: Record<string, any>;
  isB2B: boolean;
  isTransferencia?: boolean;
  isIndexed?: boolean;
  hasSelfConsumption?: boolean;
  hasSolarWallet?: boolean;
  signatureStamp?: SignatureStampInfo | null;
  summaryAcceptedStamp?: {
    acceptedAtFormatted: string;
    signerName: string;
    signerNif: string;
    ipAddress?: string | null;
    envelopeCode?: string;
  } | null;
}

export async function renderContractAndSummaryBuffers(opts: RenderContractBundleOptions): Promise<{
  contractPdfBuffer: Buffer;
  summaryPdfBuffer: Buffer;
  contractHashSha256: string;
  summaryHashSha256: string;
  templateVersionId: string;
  brandCode: string;
}> {
  const { brand, company, versionRecord, payload: dbPayload, brandCtx, brandLogoDataUri, bankAccounts } =
    await resolveBrandAndActiveTemplate(opts.brandId, opts.templateVersionId);

  const activePayload = opts.customPayloadOverride || dbPayload;

  const [contractPdfBuffer, summaryPdfBuffer] = await Promise.all([
    renderToBuffer(
      <ContractPdfTemplate
        templateData={opts.templateData}
        isB2B={opts.isB2B}
        isTransferencia={opts.isTransferencia}
        isIndexed={opts.isIndexed}
        hasSelfConsumption={opts.hasSelfConsumption}
        hasSolarWallet={opts.hasSolarWallet}
        brandCtx={brandCtx}
        brandLogoDataUri={brandLogoDataUri}
        brandAccentColor={brand.accentColor}
        bankAccounts={bankAccounts}
        sepaCreditorId={company?.sepaCreditorId}
        particularConfig={activePayload.particularConfig}
        clauses={activePayload.clauses}
        annexAutoconsumo={activePayload.annexAutoconsumo}
        sepaMandateConfig={activePayload.sepaMandateConfig}
        signatureStamp={opts.signatureStamp}
      />
    ),
    renderToBuffer(
      <SummaryPdfTemplate
        templateData={opts.templateData}
        isB2B={opts.isB2B}
        isIndexed={Boolean(opts.isIndexed)}
        isTransferencia={opts.isTransferencia}
        hasSelfConsumption={opts.hasSelfConsumption}
        hasSolarWallet={opts.hasSolarWallet}
        brandCtx={brandCtx}
        brandLogoDataUri={brandLogoDataUri}
        brandAccentColor={brand.accentColor}
        particularConfig={activePayload.particularConfig}
        summaryConfig={activePayload.summaryConfig}
        acceptedStamp={opts.summaryAcceptedStamp}
      />
    ),
  ]);

  const brandCode = (brand.codigoMarca || brand.slug || 'ERP').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

  return {
    contractPdfBuffer: Buffer.from(contractPdfBuffer),
    summaryPdfBuffer: Buffer.from(summaryPdfBuffer),
    contractHashSha256: sha256Hex(Buffer.from(contractPdfBuffer)),
    summaryHashSha256: sha256Hex(Buffer.from(summaryPdfBuffer)),
    templateVersionId: versionRecord.id,
    brandCode,
  };
}

export async function generateAndUploadContractBundle(
  opts: RenderContractBundleOptions & { contractCode: string }
): Promise<{
  contractPdfUrl: string;
  summaryPdfUrl: string;
  templateVersionId: string;
  contractHashSha256: string;
  summaryHashSha256: string;
}> {
  const rendered = await renderContractAndSummaryBuffers(opts);
  const safeCode = String(opts.contractCode || 'BORRADOR').replace(/[^a-zA-Z0-9_-]/g, '_');

  const contractFileName = `Contrato_${rendered.brandCode}_${safeCode}.pdf`;
  const summaryFileName = `Resumen_Precontractual_${rendered.brandCode}_${safeCode}.pdf`;

  const [contractPdfUrl, summaryPdfUrl] = await Promise.all([
    uploadFileToR2(`contracts/drafts/${contractFileName}`, rendered.contractPdfBuffer, 'application/pdf'),
    uploadFileToR2(`contracts/drafts/${summaryFileName}`, rendered.summaryPdfBuffer, 'application/pdf'),
  ]);

  return {
    contractPdfUrl,
    summaryPdfUrl,
    templateVersionId: rendered.templateVersionId,
    contractHashSha256: rendered.contractHashSha256,
    summaryHashSha256: rendered.summaryHashSha256,
  };
}

export async function renderModificationPdfBuffer(opts: {
  brandId?: string | null;
  templateVersionId?: string | null;
  customPayloadOverride?: BrandTemplatePayload | null;
  templateData: Record<string, any>;
  isTecnica: boolean;
  signatureStamp?: SignatureStampInfo | null;
}): Promise<{
  pdfBuffer: Buffer;
  pdfHashSha256: string;
  templateVersionId: string;
  brandCode: string;
}> {
  const { brand, company, versionRecord, payload: dbPayload, brandCtx, brandLogoDataUri } =
    await resolveBrandAndActiveTemplate(opts.brandId, opts.templateVersionId);
  const activePayload = opts.customPayloadOverride || dbPayload;

  const rawBuf = await renderToBuffer(
    <ContractModPdfTemplate
      templateData={opts.templateData}
      isTecnica={opts.isTecnica}
      brandCtx={brandCtx}
      brandLogoDataUri={brandLogoDataUri}
      brandAccentColor={brand.accentColor}
      sepaMandateConfig={activePayload.sepaMandateConfig}
      sepaCreditorId={company?.sepaCreditorId}
      signatureStamp={opts.signatureStamp}
    />
  );

  const pdfBuffer = Buffer.from(rawBuf);
  const brandCode = (brand.codigoMarca || brand.slug || 'ERP').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

  return {
    pdfBuffer,
    pdfHashSha256: sha256Hex(pdfBuffer),
    templateVersionId: versionRecord.id,
    brandCode,
  };
}
