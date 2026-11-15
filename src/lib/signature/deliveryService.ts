import { Resend } from 'resend';

const DEFAULT_VERIFIED_FROM = process.env.RESEND_FROM_EMAIL || 'noreply@sp-energia.com';

export function getPublicAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://ultra.sp-energia.com';
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }
  return 'http://localhost:3000';
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export interface BrandDeliveryIdentity {
  brandName: string;
  companyName: string;
  companyCif?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  freePhone900?: string | null;
  smsSenderId?: string | null;
}

async function sendBrandEmailWithFallback(params: {
  brand: BrandDeliveryIdentity;
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}): Promise<{ sent: boolean; providerId?: string; warning?: string }> {
  const resend = getResendClient();
  const safeDisplayName = params.brand.brandName.replace(/[<>"]/g, '').trim() || 'Contratación Digital';

  if (!resend) {
    console.warn(`[FIRMA DIGITAL - EMAIL DEV LOG] Destino: ${params.to.join(', ')} | Asunto: ${params.subject}`);
    return { sent: false, warning: 'RESEND_API_KEY no configurada en entorno.' };
  }

  const primaryFrom = params.brand.supportEmail
    ? `${safeDisplayName} <${params.brand.supportEmail}>`
    : `${safeDisplayName} <${DEFAULT_VERIFIED_FROM}>`;
  const fallbackFrom = `${safeDisplayName} <${DEFAULT_VERIFIED_FROM}>`;

  try {
    const firstAttempt = await resend.emails.send({
      from: primaryFrom,
      to: params.to,
      replyTo: params.brand.supportEmail || undefined,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });

    if (!firstAttempt.error) {
      return { sent: true, providerId: firstAttempt.data?.id };
    }

    // Si el dominio propio de una comercializadora aún no está verificado en Resend, reintentamos con el dominio verificado del ERP manteniendo replyTo de la marca
    if (primaryFrom !== fallbackFrom) {
      const retryAttempt = await resend.emails.send({
        from: fallbackFrom,
        to: params.to,
        replyTo: params.brand.supportEmail || undefined,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
      });
      if (!retryAttempt.error) {
        return { sent: true, providerId: retryAttempt.data?.id };
      }
      return { sent: false, warning: retryAttempt.error.message };
    }

    return { sent: false, warning: firstAttempt.error.message };
  } catch (err: any) {
    console.error('[FIRMA DIGITAL - ERROR EMAIL]:', err);
    return { sent: false, warning: err?.message || String(err) };
  }
}

function normalizeE164Phone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (/^[6789]\d{8}$/.test(digits)) return `+34${digits}`;
  if (/^34\d{9}$/.test(digits)) return `+${digits}`;
  return digits.length >= 9 ? `+${digits}` : null;
}

export async function sendBrandSmsOtpOrNotice(params: {
  phone?: string | null;
  senderId?: string | null;
  message: string;
}): Promise<{ sent: boolean; provider?: string; warning?: string }> {
  const e164 = normalizeE164Phone(params.phone);
  if (!e164) {
    return { sent: false, warning: 'Teléfono móvil no válido para SMS.' };
  }

  const sender = (params.senderId || 'FirmaERP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 11) || 'FirmaERP';
  const provider = (process.env.SMS_PROVIDER || '').trim().toUpperCase();

  try {
    // 1. LabsMobile (Proveedor habitual en España con remitente alfanumérico)
    if (
      (provider === 'LABSMOBILE' || (!provider && process.env.SMS_LABSMOBILE_USER)) &&
      process.env.SMS_LABSMOBILE_USER &&
      process.env.SMS_LABSMOBILE_TOKEN
    ) {
      const auth = Buffer.from(
        `${process.env.SMS_LABSMOBILE_USER}:${process.env.SMS_LABSMOBILE_TOKEN}`
      ).toString('base64');
      const resp = await fetch('https://api.labsmobile.com/json/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: params.message,
          tpoa: sender,
          recipient: [{ msisdn: e164.replace(/^\+/, '') }],
        }),
      });
      if (resp.ok) return { sent: true, provider: 'LABSMOBILE' };
      return { sent: false, provider: 'LABSMOBILE', warning: `HTTP ${resp.status}` };
    }

    // 2. Twilio
    if (
      (provider === 'TWILIO' || (!provider && process.env.TWILIO_ACCOUNT_SID)) &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN
    ) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const fromField = process.env.TWILIO_FROM_NUMBER || sender;
      const body = new URLSearchParams({
        To: e164,
        From: fromField,
        Body: params.message,
      });
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      if (resp.ok) return { sent: true, provider: 'TWILIO' };
      return { sent: false, provider: 'TWILIO', warning: `HTTP ${resp.status}` };
    }

    // 3. Generic Webhook Gateway
    if (process.env.SMS_WEBHOOK_URL) {
      const resp = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SMS_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_SECRET}` } : {}),
        },
        body: JSON.stringify({ to: e164, sender, message: params.message }),
      });
      if (resp.ok) return { sent: true, provider: 'WEBHOOK' };
      return { sent: false, provider: 'WEBHOOK', warning: `HTTP ${resp.status}` };
    }

    return { sent: false, warning: 'Pasarela SMS no configurada (usando canal Email).' };
  } catch (err: any) {
    console.warn('[FIRMA DIGITAL - AVISO SMS]:', err?.message || err);
    return { sent: false, warning: err?.message || String(err) };
  }
}

function buildEmailShell(brand: BrandDeliveryIdentity, innerHtml: string): string {
  const accent = brand.accentColor && /^#[0-9a-fA-F]{6}$/.test(brand.accentColor) ? brand.accentColor : '#14383b';
  const logoBlock = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${brand.brandName}" style="max-height: 46px; max-width: 190px; object-fit: contain;" />`
    : `<span style="font-size: 20px; font-weight: 800; color: #0f172a;">${brand.brandName}</span>`;

  const helpParts: string[] = [];
  if (brand.freePhone900) helpParts.push(`Teléfono gratuito: <strong>${brand.freePhone900}</strong>`);
  else if (brand.phone) helpParts.push(`Teléfono: <strong>${brand.phone}</strong>`);
  if (brand.supportEmail) helpParts.push(`Atención al cliente: <strong>${brand.supportEmail}</strong>`);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 28px 14px; color: #1e293b;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);">
        <div style="padding: 20px 28px; border-bottom: 3px solid ${accent}; display: flex; align-items: center; justify-content: space-between;">
          ${logoBlock}
        </div>
        <div style="padding: 28px;">
          ${innerHtml}
        </div>
        <div style="background-color: #f1f5f9; padding: 16px 28px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 6px 0;"><strong>${brand.companyName}</strong> ${brand.companyCif ? `· CIF ${brand.companyCif}` : ''}</p>
          ${helpParts.length > 0 ? `<p style="margin: 0 0 6px 0;">${helpParts.join(' · ')}</p>` : ''}
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">
            Proceso de firma electrónica conforme al Reglamento (UE) 910/2014 (eIDAS), Ley 6/2020 y Real Decreto 88/2026.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ─── T0: Invitación Inicial + Documento Resumen Precontractual (RD 88/2026) ──

export async function sendSigningInvitationEmail(params: {
  brand: BrandDeliveryIdentity;
  signerName: string;
  signerNif: string;
  signerEmail: string;
  signerPhone?: string | null;
  contractCode: string;
  cups: string;
  supplyAddress: string;
  tariff: string;
  signingUrl: string;
  flowMode: string;
  summaryPdfBuffer: Buffer;
  expiresAt: Date;
}): Promise<{ emailSent: boolean; smsSent: boolean; warning?: string }> {
  const expFormatted = params.expiresAt.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const isTwoStep = params.flowMode === 'TWO_STEP_SEPARATE_DELIVERY';

  const innerHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">
      ${isTwoStep ? 'Paso 1 de 2: Revisión de su Documento Resumen Precontractual' : 'Documentación lista para revisión y firma digital'}
    </h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Estimado/a <strong>${params.signerName}</strong>,
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      En cumplimiento del <strong>Real Decreto 88/2026</strong>, ponemos a su disposición con carácter previo y separado el
      <strong>Documento Resumen Precontractual</strong> de su suministro eléctrico con <strong>${params.brand.brandName}</strong>
      (también adjunto en formato PDF en este correo para su archivo en soporte duradero).
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #1e293b;">
      <div style="margin-bottom: 6px;"><strong>Referencia Contrato:</strong> ${params.contractCode}</div>
      <div style="margin-bottom: 6px;"><strong>Titular / NIF:</strong> ${params.signerName} (${params.signerNif})</div>
      <div style="margin-bottom: 6px;"><strong>CUPS:</strong> <span style="font-family: monospace;">${params.cups || '-'}</span> (${params.tariff || '-'})</div>
      <div><strong>Punto de suministro:</strong> ${params.supplyAddress || '-'}</div>
    </div>

    <p style="font-size: 13.5px; line-height: 1.55; color: #475569; margin: 0 0 22px 0;">
      ${
        isTwoStep
          ? 'Pulse el siguiente botón para revisar y confirmar el Documento Resumen. Una vez aceptado, recibirá inmediatamente el contrato completo para su firma.'
          : 'Pulse el siguiente botón para revisar en primer lugar el Documento Resumen Precontractual y, a continuación, formalizar la firma digital de su contrato desde cualquier móvil u ordenador:'
      }
    </p>

    <div style="text-align: center; margin: 26px 0;">
      <a href="${params.signingUrl}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">
        Revisar y Firmar Documentación
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 16px 0 0 0;">
      Este enlace seguro es personal y estará disponible hasta el <strong>${expFormatted}</strong>.
    </p>
  `;

  const safeCode = params.contractCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailRes = await sendBrandEmailWithFallback({
    brand: params.brand,
    to: [params.signerEmail],
    subject: `${params.contractCode} · Documentación de contratación eléctrica (${params.brand.brandName})`,
    html: buildEmailShell(params.brand, innerHtml),
    attachments: [
      {
        filename: `Documento_Resumen_Precontractual_${safeCode}.pdf`,
        content: params.summaryPdfBuffer,
      },
    ],
  });

  let smsSent = false;
  if (params.signerPhone) {
    const smsRes = await sendBrandSmsOtpOrNotice({
      phone: params.signerPhone,
      senderId: params.brand.smsSenderId,
      message: `${params.brand.brandName}: Su documentacion de suministro (${params.contractCode}) esta lista para revisar y firmar: ${params.signingUrl}`,
    });
    smsSent = smsRes.sent;
  }

  return { emailSent: emailRes.sent, smsSent, warning: emailRes.warning };
}

// ─── T1 (Modo Dos Envíos Separados): Desbloqueo y Envío del Contrato ─────────

export async function sendStep2ContractUnlockedEmail(params: {
  brand: BrandDeliveryIdentity;
  signerName: string;
  signerEmail: string;
  contractCode: string;
  cups: string;
  signingUrl: string;
  contractPdfBuffer: Buffer;
}): Promise<{ emailSent: boolean; warning?: string }> {
  const innerHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">
      Paso 2 de 2: Su Contrato de Suministro está listo para firmar
    </h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Estimado/a <strong>${params.signerName}</strong>,
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 18px 0;">
      Hemos registrado correctamente su lectura y conformidad con el <strong>Documento Resumen Precontractual</strong>
      del suministro <strong>${params.cups}</strong>. A continuación le remitimos las Condiciones Particulares y Generales
      completas de su contrato (<strong>${params.contractCode}</strong>) para proceder con la firma electrónica:
    </p>
    <div style="text-align: center; margin: 26px 0;">
      <a href="${params.signingUrl}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">
        Acceder a la Firma del Contrato
      </a>
    </div>
  `;

  const safeCode = params.contractCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const res = await sendBrandEmailWithFallback({
    brand: params.brand,
    to: [params.signerEmail],
    subject: `${params.contractCode} · Paso 2: Firma de Contrato de Suministro (${params.brand.brandName})`,
    html: buildEmailShell(params.brand, innerHtml),
    attachments: [
      {
        filename: `Borrador_Contrato_${safeCode}.pdf`,
        content: params.contractPdfBuffer,
      },
    ],
  });

  return { emailSent: res.sent, warning: res.warning };
}

// ─── T2a: Envío de Código OTP de 6 dígitos (SMS + Email simultáneo) ──────────

export async function sendOtpCodeNotification(params: {
  brand: BrandDeliveryIdentity;
  signerName: string;
  signerEmail: string;
  signerPhone?: string | null;
  contractCode: string;
  otpCode: string;
}): Promise<{ channelUsed: string; smsSent: boolean; emailSent: boolean }> {
  const smsPromise = params.signerPhone
    ? sendBrandSmsOtpOrNotice({
        phone: params.signerPhone,
        senderId: params.brand.smsSenderId,
        message: `${params.brand.brandName}: Su codigo de verificacion para firmar el contrato ${params.contractCode} es ${params.otpCode}. Valido durante 10 min.`,
      })
    : Promise.resolve({ sent: false });

  const innerHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 19px; color: #0f172a;">
      Código de seguridad para firmar su contrato
    </h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Hola <strong>${params.signerName}</strong>, introduzca el siguiente código de verificación de 6 dígitos en la pantalla
      de firma para confirmar electrónicamente el contrato <strong>${params.contractCode}</strong>:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; background-color: #f1f5f9; border: 2px solid #0f172a; border-radius: 10px; padding: 14px 32px; font-family: monospace; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">
        ${params.otpCode}
      </div>
    </div>
    <p style="font-size: 12.5px; color: #64748b; text-align: center; margin: 0;">
      Este código caduca en <strong>10 minutos</strong>. No lo comparta con terceros.
    </p>
  `;

  const [smsRes, emailRes] = await Promise.all([
    smsPromise,
    sendBrandEmailWithFallback({
      brand: params.brand,
      to: [params.signerEmail],
      subject: `${params.otpCode} es su código de firma · ${params.brand.brandName}`,
      html: buildEmailShell(params.brand, innerHtml),
    }),
  ]);

  let channelUsed = 'EMAIL';
  if (smsRes.sent && emailRes.sent) channelUsed = 'SMS + EMAIL';
  else if (smsRes.sent) channelUsed = 'SMS';

  return {
    channelUsed,
    smsSent: smsRes.sent,
    emailSent: emailRes.sent,
  };
}

// ─── T3: Entrega en Soporte Duradero de Copia Sellada + Certificado ──────────

export async function sendSignedDurableMediumEmail(params: {
  brand: BrandDeliveryIdentity;
  signerName: string;
  signerEmail: string;
  contractCode: string;
  envelopeCode: string;
  cups: string;
  verificationUrl: string;
  signedContractBuffer: Buffer;
  signedSummaryBuffer: Buffer;
  standaloneAuditCertificateBuffer?: Buffer | null;
}): Promise<{ emailSent: boolean; warning?: string }> {
  const safeCode = params.contractCode.replace(/[^a-zA-Z0-9_-]/g, '_');

  const innerHtml = `
    <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">
      Confirmación de Firma Electrónica — Copia en Soporte Duradero
    </h2>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Estimado/a <strong>${params.signerName}</strong>,
    </p>
    <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
      Su contrato de suministro eléctrico <strong>${params.contractCode}</strong> (CUPS <code>${params.cups}</code>)
      con <strong>${params.brand.brandName}</strong> ha quedado formalizado y sellado criptográficamente.
    </p>
    <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
      Adjuntamos a este mensaje su ejemplar íntegro en soporte duradero junto con el Documento Resumen Precontractual
      aceptado y el Certificado de Evidencias Electrónicas (ID de sobre: <strong>${params.envelopeCode}</strong>).
    </p>
    <div style="text-align: center; margin: 22px 0;">
      <a href="${params.verificationUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13.5px; display: inline-block;">
        Verificar Autenticidad del Sobre (${params.envelopeCode})
      </a>
    </div>
  `;

  const attachments: Array<{ filename: string; content: Buffer }> = [
    {
      filename: `Contrato_Firmado_${safeCode}.pdf`,
      content: params.signedContractBuffer,
    },
    {
      filename: `Documento_Resumen_Aceptado_${safeCode}.pdf`,
      content: params.signedSummaryBuffer,
    },
  ];

  if (params.standaloneAuditCertificateBuffer) {
    attachments.push({
      filename: `Certificado_Evidencias_${params.envelopeCode}.pdf`,
      content: params.standaloneAuditCertificateBuffer,
    });
  }

  const res = await sendBrandEmailWithFallback({
    brand: params.brand,
    to: [params.signerEmail],
    subject: `${params.contractCode} · Copia firmada de su contrato eléctrico (${params.brand.brandName})`,
    html: buildEmailShell(params.brand, innerHtml),
    attachments,
  });

  return { emailSent: res.sent, warning: res.warning };
}
