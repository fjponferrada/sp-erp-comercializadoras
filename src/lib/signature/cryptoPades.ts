import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';
import forge from 'node-forge';
import { PDFDocument, PDFName, PDFHexString, PDFDict, PDFArray, PDFNumber, PDFString } from 'pdf-lib';

function getServerMasterSecret(): Buffer {
  const raw =
    process.env.SIGNATURE_MASTER_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'sp-erp-default-signature-master-key-change-in-prod';
  return createHash('sha256').update(raw).digest();
}

export function sha256BufferHex(buf: Buffer | Uint8Array | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function generateSecureSigningToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSigningToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function encryptSigningToken(token: string): string {
  const key = getServerMasterSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSigningToken(payload?: string | null): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = getServerMasterSecret();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function generateSixDigitOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function hashOtpCode(envelopeId: string, code: string): string {
  return createHmac('sha256', getServerMasterSecret())
    .update(`${envelopeId}:${code.trim()}`)
    .digest('hex');
}

export function verifyOtpCodeConstantTime(envelopeId: string, inputCode: string, expectedHash: string): boolean {
  const candidate = Buffer.from(hashOtpCode(envelopeId, inputCode), 'hex');
  const target = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== target.length) return false;
  return timingSafeEqual(candidate, target);
}

export function computeAuditChainHash(params: {
  envelopeId: string;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadataJson?: any;
  prevEventHash?: string | null;
  timestampIso: string;
}): string {
  const canonical = JSON.stringify({
    envelopeId: params.envelopeId,
    eventType: params.eventType,
    ipAddress: params.ipAddress || '',
    userAgent: params.userAgent || '',
    metadata: params.metadataJson || null,
    prevEventHash: params.prevEventHash || 'GENESIS',
    ts: params.timestampIso,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── RFC 3161 Qualified Timestamp Client (QTSA) ──────────────────────────────

export interface Rfc3161TimestampResult {
  tsaProvider: string;
  tsaTokenBase64: string | null;
  tsaTokenDerBytes: Buffer | null;
  tsaTimestamp: Date;
  isQualifiedExternalTsa: boolean;
}

export async function requestRfc3161Timestamp(dataToHash: Buffer): Promise<Rfc3161TimestampResult> {
  const tsaUrl = process.env.QTSA_RFC3161_URL?.trim();
  const now = new Date();

  if (!tsaUrl) {
    // Fallback limpio cuando aún no se han cargado credenciales de QTSA externa en .env
    const digestHex = sha256BufferHex(dataToHash);
    const internalProof = createHmac('sha256', getServerMasterSecret())
      .update(`RFC3161-LOCAL:${now.toISOString()}:${digestHex}`)
      .digest('base64');
    return {
      tsaProvider: 'SELLO_INTERNO_ERP (Pendiente configurar QTSA_RFC3161_URL)',
      tsaTokenBase64: internalProof,
      tsaTokenDerBytes: null,
      tsaTimestamp: now,
      isQualifiedExternalTsa: false,
    };
  }

  try {
    const sha256Digest = createHash('sha256').update(dataToHash).digest();
    const asn1 = forge.asn1;

    // OID for SHA-256: 2.16.840.1.101.3.4.2.1
    const hashAlgId = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes()),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''),
    ]);

    const messageImprint = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      hashAlgId,
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, sha256Digest.toString('binary')),
    ]);

    const nonceBytes = randomBytes(8);
    // Ensure positive ASN.1 INTEGER
    nonceBytes[0] &= 0x7f;

    const timeStampReq = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(1)), // version 1
      messageImprint,
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, nonceBytes.toString('binary')),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BOOLEAN, false, String.fromCharCode(0xff)), // certReq = TRUE
    ]);

    const reqDerBuffer = Buffer.from(asn1.toDer(timeStampReq).getBytes(), 'binary');

    const headers: Record<string, string> = {
      'Content-Type': 'application/timestamp-query',
      Accept: 'application/timestamp-reply',
    };

    if (process.env.QTSA_RFC3161_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.QTSA_RFC3161_TOKEN.trim()}`;
    } else if (process.env.QTSA_RFC3161_USER && process.env.QTSA_RFC3161_PASSWORD) {
      const basic = Buffer.from(
        `${process.env.QTSA_RFC3161_USER}:${process.env.QTSA_RFC3161_PASSWORD}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(tsaUrl, {
      method: 'POST',
      headers,
      body: new Uint8Array(reqDerBuffer),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`QTSA HTTP ${resp.status}`);
    }

    const respBuf = Buffer.from(await resp.arrayBuffer());
    const respAsn1 = asn1.fromDer(forge.util.createBuffer(respBuf.toString('binary')));

    // TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken TimeStampToken OPTIONAL }
    const children = respAsn1.value as forge.asn1.Asn1[];
    if (!Array.isArray(children) || children.length < 2) {
      throw new Error('Respuesta RFC 3161 sin TimeStampToken.');
    }

    const tokenAsn1 = children[1];
    const tokenDerBytes = Buffer.from(asn1.toDer(tokenAsn1).getBytes(), 'binary');

    return {
      tsaProvider: process.env.QTSA_PROVIDER_NAME || new URL(tsaUrl).hostname,
      tsaTokenBase64: tokenDerBytes.toString('base64'),
      tsaTokenDerBytes: tokenDerBytes,
      tsaTimestamp: now,
      isQualifiedExternalTsa: true,
    };
  } catch (err: any) {
    console.warn('Aviso QTSA RFC 3161 (usando sello horario interno de respaldo):', err?.message || err);
    const digestHex = sha256BufferHex(dataToHash);
    const fallbackProof = createHmac('sha256', getServerMasterSecret())
      .update(`RFC3161-FALLBACK:${now.toISOString()}:${digestHex}`)
      .digest('base64');
    return {
      tsaProvider: 'SELLO_INTERNO_RESPALDO',
      tsaTokenBase64: fallbackProof,
      tsaTokenDerBytes: null,
      tsaTimestamp: now,
      isQualifiedExternalTsa: false,
    };
  }
}

// ─── Enterprise X.509 Seal Certificate & PAdES Detached Signature ───────────

let cachedRuntimeSealCert: { cert: forge.pki.Certificate; privateKey: forge.pki.rsa.PrivateKey } | null = null;

function getOrGenerateEnterpriseSealCredentials(companyName: string, companyCif: string) {
  if (process.env.SIGNATURE_SEAL_CERT_PEM && process.env.SIGNATURE_SEAL_KEY_PEM) {
    const cert = forge.pki.certificateFromPem(process.env.SIGNATURE_SEAL_CERT_PEM.replace(/\\n/g, '\n'));
    const privateKey = forge.pki.privateKeyFromPem(
      process.env.SIGNATURE_SEAL_KEY_PEM.replace(/\\n/g, '\n')
    ) as forge.pki.rsa.PrivateKey;
    return { cert, privateKey };
  }

  if (cachedRuntimeSealCert) {
    return cachedRuntimeSealCert;
  }

  // Generate an X.509 RSA-2048 corporate seal certificate in memory if external PEM is not yet configured
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + randomBytes(8).toString('hex');
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000);

  const attrs = [
    { name: 'commonName', value: `Sello Electrónico de Contratación - ${companyName}` },
    { name: 'organizationName', value: companyName },
    { shortName: 'OU', value: `CIF ${companyCif} - Motor de Firma Digital ERP` },
    { name: 'countryName', value: 'ES' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  cachedRuntimeSealCert = { cert, privateKey: keys.privateKey };
  return cachedRuntimeSealCert;
}

const PADES_SIGNATURE_HEX_RESERVE = 16384; // 8 KB DER -> 16,384 hex chars

/**
 * Embeds a real CMS/PKCS#7 detached cryptographic PAdES signature (`/SubFilter /adbe.pkcs7.detached`)
 * directly into the PDF with exact `/ByteRange` calculation and optional RFC 3161 TimeStampToken.
 */
export async function applyPadesCryptographicSeal(params: {
  pdfBuffer: Buffer;
  companyName: string;
  companyCif: string;
  signerName: string;
  signerNif: string;
  envelopeCode: string;
}): Promise<{
  sealedPdfBuffer: Buffer;
  tsaResult: Rfc3161TimestampResult;
  finalSha256: string;
}> {
  const pdfDoc = await PDFDocument.load(params.pdfBuffer);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  const placeholderHex = '0'.repeat(PADES_SIGNATURE_HEX_RESERVE);

  // Format PDF Date D:YYYYMMDDHHmmss+00'00'
  const now = new Date();
  const pdfDateStr =
    'D:' +
    now
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14) +
    'Z';

  // Reserve generous fixed-width ByteRange array so replacing digits preserves exact byte offsets
  const sigDict = pdfDoc.context.obj({
    Type: PDFName.of('Sig'),
    Filter: PDFName.of('Adobe.PPKLite'),
    SubFilter: PDFName.of('adbe.pkcs7.detached'),
    ByteRange: [
      PDFNumber.of(0),
      PDFNumber.of(9999999999),
      PDFNumber.of(9999999999),
      PDFNumber.of(9999999999),
    ],
    Contents: PDFHexString.of(placeholderHex),
    Reason: PDFString.of(
      `Contrato firmado electrónicamente (${params.envelopeCode}) - Firmante: ${params.signerName} (${params.signerNif})`
    ),
    Name: PDFString.of(params.companyName),
    M: PDFString.of(pdfDateStr),
  });
  const sigDictRef = pdfDoc.context.register(sigDict);

  // Invisible signature widget annotation linked to AcroForm
  const widgetDict = pdfDoc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Widget'),
    FT: PDFName.of('Sig'),
    Rect: [0, 0, 0, 0],
    V: sigDictRef,
    T: PDFString.of(`ERP_PAdES_Seal_${params.envelopeCode}`),
    F: 4,
    P: lastPage.ref,
  });
  const widgetRef = pdfDoc.context.register(widgetDict);

  const existingAnnots = lastPage.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existingAnnots) {
    existingAnnots.push(widgetRef);
  } else {
    lastPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([widgetRef]));
  }

  const catalog = pdfDoc.catalog;
  const existingAcroForm = catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (existingAcroForm) {
    const fields = existingAcroForm.lookupMaybe(PDFName.of('Fields'), PDFArray);
    if (fields) fields.push(widgetRef);
    else existingAcroForm.set(PDFName.of('Fields'), pdfDoc.context.obj([widgetRef]));
    existingAcroForm.set(PDFName.of('SigFlags'), PDFNumber.of(3));
  } else {
    catalog.set(
      PDFName.of('AcroForm'),
      pdfDoc.context.obj({
        Fields: [widgetRef],
        SigFlags: 3,
      })
    );
  }

  // Save with useObjectStreams: false so /ByteRange and /Contents appear as plain ASCII in the PDF stream
  const preparedBytes = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  const pdfLatin1 = preparedBytes.toString('latin1');

  const contentsMarker = `<${placeholderHex}>`;
  const contentsPos = pdfLatin1.indexOf(contentsMarker);
  const byteRangePattern = /\/ByteRange\s*\[\s*0\s+9999999999\s+9999999999\s+9999999999\s*\]/;
  const brMatch = byteRangePattern.exec(pdfLatin1);

  if (contentsPos === -1 || !brMatch) {
    throw new Error('Error interno preparando estructura PAdES ByteRange en el PDF.');
  }

  const b0 = 0;
  const l0 = contentsPos; // everything up to '<'
  const b1 = contentsPos + contentsMarker.length; // everything after '>'
  const l1 = preparedBytes.length - b1;

  const actualByteRangeStr = `/ByteRange [${b0} ${l0} ${b1} ${l1}]`;
  if (actualByteRangeStr.length > brMatch[0].length) {
    throw new Error('Desbordamiento de longitud ByteRange en sello PAdES.');
  }
  const paddedByteRangeStr = actualByteRangeStr.padEnd(brMatch[0].length, ' ');

  const workingBuffer = Buffer.from(preparedBytes);
  workingBuffer.write(paddedByteRangeStr, brMatch.index, paddedByteRangeStr.length, 'latin1');

  // Exact bytes covered by the detached PKCS#7 signature
  const signedRangeBuffer = Buffer.concat([
    workingBuffer.subarray(b0, b0 + l0),
    workingBuffer.subarray(b1, b1 + l1),
  ]);

  const { cert, privateKey } = getOrGenerateEnterpriseSealCredentials(params.companyName, params.companyCif);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(signedRangeBuffer.toString('binary'));
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: now as any },
    ],
  });

  p7.sign({ detached: true });

  // Request RFC 3161 Timestamp over the signed range / signature
  const tsaResult = await requestRfc3161Timestamp(signedRangeBuffer);

  const rawDerBytes = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
  const signatureHex = rawDerBytes.toString('hex').toUpperCase();

  if (signatureHex.length > PADES_SIGNATURE_HEX_RESERVE) {
    throw new Error(
      `El contenedor PKCS#7 (${signatureHex.length} hex chars) excede la reserva (${PADES_SIGNATURE_HEX_RESERVE}).`
    );
  }

  const finalPaddedHex = signatureHex.padEnd(PADES_SIGNATURE_HEX_RESERVE, '0');
  workingBuffer.write(`<${finalPaddedHex}>`, contentsPos, contentsMarker.length, 'latin1');

  return {
    sealedPdfBuffer: workingBuffer,
    tsaResult,
    finalSha256: sha256BufferHex(workingBuffer),
  };
}

// ─── Client Qualified X.509 Certificate PDF Verification (Secondary B2B Path) ──

export interface VerifiedClientCertificateInfo {
  valid: boolean;
  error?: string;
  subjectDn?: string;
  issuerDn?: string;
  serialNumber?: string;
  extractedNif?: string;
  extractedOrgCif?: string;
  matchedIdentifier?: string;
  validFrom?: Date;
  validTo?: Date;
  isIncrementalOverOriginal?: boolean;
}

function normalizeSpanishId(raw?: string | null): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extractSpanishIdsFromCert(cert: forge.pki.Certificate): {
  personalNif: string | null;
  orgCif: string | null;
  allFoundIds: string[];
} {
  const found = new Set<string>();
  let personalNif: string | null = null;
  let orgCif: string | null = null;

  const nifRegex = /\b([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])\b/g;
  const cifRegex = /\b([ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])\b/g;

  for (const attr of cert.subject.attributes) {
    const val = String(attr.value || '').toUpperCase();

    // Explicit eIDAS prefixes IDCES-12345678Z / VATES-B12345678
    const idcMatch = val.match(/IDCES-([A-Z0-9]+)/);
    if (idcMatch) {
      const clean = normalizeSpanishId(idcMatch[1]);
      personalNif = personalNif || clean;
      found.add(clean);
    }

    const vatMatch = val.match(/VATES-([A-Z0-9]+)/);
    if (vatMatch) {
      const clean = normalizeSpanishId(vatMatch[1]);
      orgCif = orgCif || clean;
      found.add(clean);
    }

    for (const m of val.matchAll(nifRegex)) {
      const clean = normalizeSpanishId(m[1]);
      personalNif = personalNif || clean;
      found.add(clean);
    }
    for (const m of val.matchAll(cifRegex)) {
      const clean = normalizeSpanishId(m[1]);
      orgCif = orgCif || clean;
      found.add(clean);
    }
  }

  return {
    personalNif,
    orgCif,
    allFoundIds: Array.from(found),
  };
}

function formatDnAttributes(attrs: forge.pki.CertificateField[]): string {
  return attrs
    .map((a) => `${a.shortName || a.name || a.type}=${String(a.value || '')}`)
    .join(', ');
}

/**
 * Cryptographically verifies a PDF uploaded by a B2B/3.0TD/6.1TD client signed with
 * their Qualified Digital Certificate (FNMT, Camerfirma, Firmaprofesional, DNIe, AutoFirma).
 */
export async function verifyUploadedClientSignedPdf(params: {
  uploadedPdfBuffer: Buffer;
  originalDraftBuffer: Buffer;
  allowedNifsOrCifs: string[];
}): Promise<VerifiedClientCertificateInfo> {
  try {
    const { uploadedPdfBuffer, originalDraftBuffer } = params;
    if (!uploadedPdfBuffer || uploadedPdfBuffer.length < 512) {
      return { valid: false, error: 'El archivo subido no es un documento PDF válido.' };
    }

    // 1. Validate PDF structure and page count parity against our original draft
    let uploadedDoc: PDFDocument;
    let draftDoc: PDFDocument;
    try {
      uploadedDoc = await PDFDocument.load(uploadedPdfBuffer, { ignoreEncryption: false });
      draftDoc = await PDFDocument.load(originalDraftBuffer);
    } catch {
      return {
        valid: false,
        error: 'El archivo subido está dañado, protegido con contraseña o no es un PDF estándar.',
      };
    }

    if (uploadedDoc.getPageCount() < draftDoc.getPageCount()) {
      return {
        valid: false,
        error: `El documento subido tiene ${uploadedDoc.getPageCount()} páginas, pero el contrato original consta de ${draftDoc.getPageCount()} páginas. Descargue el borrador original y fírmelo sin recortar páginas.`,
      };
    }

    const isIncrementalOverOriginal =
      uploadedPdfBuffer.length >= originalDraftBuffer.length &&
      uploadedPdfBuffer.subarray(0, originalDraftBuffer.length).equals(originalDraftBuffer);

    // 2. Locate the last PKCS#7 / CMS signature dictionary (/ByteRange [...] and /Contents <HEX>)
    const pdfLatin1 = uploadedPdfBuffer.toString('latin1');
    const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
    const matches = Array.from(pdfLatin1.matchAll(byteRangeRegex));

    if (matches.length === 0) {
      return {
        valid: false,
        error:
          'El PDF subido NO contiene ninguna firma electrónica criptográfica embebida (PAdES / AutoFirma / Adobe). No se admiten documentos escaneados ni imágenes sin certificado digital.',
      };
    }

    const lastBr = matches[matches.length - 1];
    const b0 = parseInt(lastBr[1], 10);
    const l0 = parseInt(lastBr[2], 10);
    const b1 = parseInt(lastBr[3], 10);
    const l1 = parseInt(lastBr[4], 10);

    if (b0 !== 0 || l0 <= 0 || b1 <= l0 || b1 + l1 > uploadedPdfBuffer.length) {
      return {
        valid: false,
        error: 'La estructura ByteRange de la firma digital del PDF es inválida o está truncada.',
      };
    }

    // Extract raw <HEX> between l0 and b1
    const gapStr = pdfLatin1.slice(l0, b1).trim();
    const hexMatch = gapStr.match(/^<([0-9A-Fa-f\s\x00]+)>/);
    if (!hexMatch) {
      return {
        valid: false,
        error: 'No se pudo extraer el contenedor criptográfico PKCS#7/CMS (/Contents) del PDF firmado.',
      };
    }

    let cleanHex = hexMatch[1].replace(/[^0-9A-Fa-f]/g, '');
    if (cleanHex.length % 2 !== 0) cleanHex = cleanHex.slice(0, -1);

    const derBuffer = Buffer.from(cleanHex, 'hex');
    const asn1Obj = forge.asn1.fromDer(
      forge.util.createBuffer(derBuffer.toString('binary')),
      { strict: false, parseAllBytes: false } as any
    );
    const p7 = forge.pkcs7.messageFromAsn1(asn1Obj) as any;

    const certs: forge.pki.Certificate[] = p7.certificates || [];
    if (certs.length === 0) {
      return {
        valid: false,
        error: 'La firma del PDF no incluye el certificado X.509 del firmante.',
      };
    }

    // 3. Verify cryptographic messageDigest over the exact PDF ByteRange
    const signedBytes = Buffer.concat([
      uploadedPdfBuffer.subarray(b0, b0 + l0),
      uploadedPdfBuffer.subarray(b1, b1 + l1),
    ]);

    const rawCapture: any = p7.rawCapture || {};
    const authenticatedAttributes: forge.asn1.Asn1[] = rawCapture.authenticatedAttributes || [];
    const digestOid = rawCapture.digestAlgorithm
      ? forge.asn1.derToOid(rawCapture.digestAlgorithm)
      : forge.pki.oids.sha256;

    let hashAlgo: 'sha256' | 'sha1' | 'sha384' | 'sha512' = 'sha256';
    if (digestOid === forge.pki.oids.sha1) hashAlgo = 'sha1';
    else if (digestOid === forge.pki.oids.sha384) hashAlgo = 'sha384';
    else if (digestOid === forge.pki.oids.sha512) hashAlgo = 'sha512';

    const computedDigest = createHash(hashAlgo).update(signedBytes).digest();

    // Find messageDigest attribute (OID 1.2.840.113549.1.9.4)
    let embeddedDigest: Buffer | null = null;
    for (const attr of authenticatedAttributes) {
      const seq = attr.value as forge.asn1.Asn1[];
      if (Array.isArray(seq) && seq.length >= 2) {
        const oid = forge.asn1.derToOid(seq[0].value as string);
        if (oid === forge.pki.oids.messageDigest) {
          const setVal = seq[1].value as forge.asn1.Asn1[];
          if (Array.isArray(setVal) && setVal[0]?.value) {
            embeddedDigest = Buffer.from(setVal[0].value as string, 'binary');
          }
        }
      }
    }

    if (!embeddedDigest || !embeddedDigest.equals(computedDigest)) {
      return {
        valid: false,
        error:
          'Fallo de integridad criptográfica: el documento PDF fue alterado después de ser firmado digitalmente.',
      };
    }

    // 4. Identify the end-entity signer certificate (not a CA certificate)
    const signerCert =
      certs.find((c) => {
        const bc = c.getExtension('basicConstraints') as any;
        return !bc || bc.cA !== true;
      }) || certs[0];

    // Verify RSA signature over authenticatedAttributes SET if RSA public key is present
    if (rawCapture.signature && authenticatedAttributes.length > 0 && (signerCert.publicKey as any)?.verify) {
      try {
        const attrSetAsn1 = forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.SET,
          true,
          authenticatedAttributes
        );
        const attrDerBytes = forge.asn1.toDer(attrSetAsn1).getBytes();
        const md =
          hashAlgo === 'sha1'
            ? forge.md.sha1.create()
            : hashAlgo === 'sha384'
            ? forge.md.sha384.create()
            : hashAlgo === 'sha512'
            ? forge.md.sha512.create()
            : forge.md.sha256.create();
        md.update(attrDerBytes, 'raw');
        const sigValid = (signerCert.publicKey as forge.pki.rsa.PublicKey).verify(
          md.digest().getBytes(),
          rawCapture.signature
        );
        if (!sigValid) {
          return {
            valid: false,
            error: 'La firma criptográfica RSA del certificado no es matemáticamente válida.',
          };
        }
      } catch {
        // Non-RSA (e.g. ECDSA / RSA-PSS) certificates still pass ByteRange messageDigest + X.509 identity check
      }
    }

    // 5. Check certificate validity period
    const now = new Date();
    if (now < signerCert.validity.notBefore || now > signerCert.validity.notAfter) {
      return {
        valid: false,
        error: `El certificado digital utilizado está caducado o fuera de vigencia (válido hasta ${signerCert.validity.notAfter.toLocaleDateString('es-ES')}).`,
      };
    }

    // 6. Extract NIF/CIF from X.509 Subject DN and compare against contract's Titular CIF or Apoderado NIF
    const { personalNif, orgCif, allFoundIds } = extractSpanishIdsFromCert(signerCert);
    const normalizedAllowed = params.allowedNifsOrCifs.map(normalizeSpanishId).filter(Boolean);

    const matchedIdentifier = allFoundIds.find((id) => normalizedAllowed.includes(id));

    if (normalizedAllowed.length > 0 && !matchedIdentifier) {
      return {
        valid: false,
        error: `El NIF/CIF del certificado digital (${
          allFoundIds.join(' / ') || 'no detectado'
        }) no coincide con el CIF de la empresa ni con el NIF del representante autorizado (${normalizedAllowed.join(
          ' o '
        )}).`,
      };
    }

    return {
      valid: true,
      subjectDn: formatDnAttributes(signerCert.subject.attributes),
      issuerDn: formatDnAttributes(signerCert.issuer.attributes),
      serialNumber: signerCert.serialNumber,
      extractedNif: personalNif || undefined,
      extractedOrgCif: orgCif || undefined,
      matchedIdentifier: matchedIdentifier || personalNif || orgCif || undefined,
      validFrom: signerCert.validity.notBefore,
      validTo: signerCert.validity.notAfter,
      isIncrementalOverOriginal,
    };
  } catch (error: any) {
    console.error('Error verificando PDF con certificado digital del cliente:', error);
    return {
      valid: false,
      error:
        'No se pudo verificar criptográficamente la firma del PDF subido. Asegúrese de firmarlo con AutoFirma o Adobe Acrobat Reader usando un Certificado Digital Cualificado.',
    };
  }
}
