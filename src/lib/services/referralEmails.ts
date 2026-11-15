import { Resend } from 'resend';

const DEFAULT_VERIFIED_FROM = process.env.RESEND_FROM_EMAIL || 'noreply@sp-energia.com';

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export interface ReferralBrandEmailInfo {
  brandName: string;
  companyName?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  domain?: string | null;
}

export function buildPublicReferralLink(
  domain: string | null | undefined,
  code: string,
  fallbackBrandCodeOrName?: string | null
): string {
  const cleanCode = encodeURIComponent(code.trim().toUpperCase());
  const rawDomain = (domain || '').trim() || (process.env.NEXT_PUBLIC_DEFAULT_REFERRAL_DOMAIN || '').trim();
  if (!rawDomain) {
    const hint = String(fallbackBrandCodeOrName || code || '').toUpperCase();
    if (hint.startsWith('AED-') || hint.includes('AED')) {
      return `https://www.aed-energia.com/contratar?ref=${cleanCode}`;
    }
    return '';
  }
  let cleanDomain = rawDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (cleanDomain.startsWith('clientes.')) {
    cleanDomain = `www.${cleanDomain.slice('clientes.'.length)}`;
  } else if (!cleanDomain.startsWith('www.') && cleanDomain.split('.').length === 2) {
    cleanDomain = `www.${cleanDomain}`;
  }
  return `https://${cleanDomain}/contratar?ref=${cleanCode}`;
}

async function sendReferralHtmlEmail(params: {
  brand: ReferralBrandEmailInfo;
  to: string | null | undefined;
  subject: string;
  html: string;
}): Promise<boolean> {
  const recipient = (params.to || '').trim();
  if (!recipient || !recipient.includes('@')) return false;

  const resend = getResendClient();
  const safeDisplayName =
    (params.brand.brandName || 'Plan Amigo').replace(/[<>"]/g, '').trim() || 'Plan Amigo';

  if (!resend) {
    console.info(`[PLAN AMIGO EMAIL DEV] Destino: ${recipient} | Asunto: ${params.subject}`);
    return false;
  }

  const primaryFrom = params.brand.supportEmail
    ? `${safeDisplayName} <${params.brand.supportEmail}>`
    : `${safeDisplayName} <${DEFAULT_VERIFIED_FROM}>`;
  const fallbackFrom = `${safeDisplayName} <${DEFAULT_VERIFIED_FROM}>`;

  try {
    const first = await resend.emails.send({
      from: primaryFrom,
      to: [recipient],
      replyTo: params.brand.supportEmail || undefined,
      subject: params.subject,
      html: params.html,
    });
    if (!first.error) return true;

    if (primaryFrom !== fallbackFrom) {
      const retry = await resend.emails.send({
        from: fallbackFrom,
        to: [recipient],
        replyTo: params.brand.supportEmail || undefined,
        subject: params.subject,
        html: params.html,
      });
      return !retry.error;
    }
    return false;
  } catch (err) {
    console.error('[PLAN AMIGO EMAIL ERROR]:', err);
    return false;
  }
}

function wrapEmailLayout(params: {
  brand: ReferralBrandEmailInfo;
  badge: string;
  title: string;
  bodyHtml: string;
}): string {
  const accent = params.brand.accentColor || '#1B4241';
  const logoHtml = params.brand.logoUrl
    ? `<img src="${params.brand.logoUrl}" alt="${params.brand.brandName}" style="max-height:42px;margin-bottom:14px;" />`
    : `<div style="font-size:20px;font-weight:800;color:#0F172A;margin-bottom:12px;">${params.brand.brandName}</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;">
  <div style="max-width:580px;margin:0 auto;background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
    <div style="padding:28px 32px;border-bottom:1px solid #F1F5F9;">
      ${logoHtml}
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#F1F5F9;color:#334155;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
        ${params.badge}
      </div>
      <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#0F172A;">${params.title}</h1>
    </div>
    <div style="padding:28px 32px;font-size:15px;line-height:1.6;color:#334155;">
      ${params.bodyHtml}
    </div>
    <div style="padding:18px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;">
      <strong>${params.brand.brandName}</strong>${params.brand.companyName ? ` · ${params.brand.companyName}` : ''}<br/>
      ${params.brand.supportEmail ? `Atención al cliente: ${params.brand.supportEmail}` : ''}
      ${params.brand.phone ? ` · Tel: ${params.brand.phone}` : ''}
      <div style="margin-top:6px;height:3px;width:48px;background:${accent};border-radius:2px;"></div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendReferrerInviteSignedEmail(params: {
  brand: ReferralBrandEmailInfo;
  referrerEmail: string | null | undefined;
  referrerName: string;
  referredMaskedName: string;
  rewardEur: number;
  minActiveDays: number;
}): Promise<boolean> {
  const amt = params.rewardEur.toFixed(2).replace('.', ',');
  const waitText =
    params.minActiveDays > 0
      ? `una vez se active su suministro con distribuidora y cumpla los ${params.minActiveDays} días de consolidación`
      : `en cuanto distribuidora confirme la activación de su suministro`;

  const html = wrapEmailLayout({
    brand: params.brand,
    badge: 'Plan Amigo · Invitación en curso',
    title: `¡${params.referredMaskedName} se une gracias a tu recomendación!`,
    bodyHtml: `
      <p>Hola <strong>${params.referrerName}</strong>,</p>
      <p>Te confirmamos que <strong>${params.referredMaskedName}</strong> acaba de completar su solicitud con tu código personal del <strong>Plan Amigo</strong>.</p>
      <div style="margin:20px 0;padding:18px;border-radius:12px;background:#F0FDF4;border:1px solid #BBF7D0;">
        <div style="font-size:13px;color:#166534;font-weight:600;">Tu bonificación prevista</div>
        <div style="font-size:26px;font-weight:800;color:#14532D;margin-top:4px;">+${amt} €</div>
        <div style="font-size:13px;color:#15803D;margin-top:4px;">Se abonará automáticamente en tu monedero ${waitText}.</div>
      </div>
      <p style="margin-bottom:0;">Te avisaremos por este mismo correo en el instante en que tu saldo quede desbloqueado para tu próxima factura eléctrica.</p>
    `,
  });

  return sendReferralHtmlEmail({
    brand: params.brand,
    to: params.referrerEmail,
    subject: `¡Tu amigo ${params.referredMaskedName} ya está en marcha! (+${amt} € Plan Amigo)`,
    html,
  });
}

export async function sendReferralRewardedEmails(params: {
  brand: ReferralBrandEmailInfo;
  referrerEmail: string | null | undefined;
  referrerName: string;
  referrerCode: string;
  referrerRewardEur: number;
  referrerNewBalanceEur: number;
  referredEmail: string | null | undefined;
  referredName: string;
  referredOwnCode: string | null;
  referredRewardEur: number;
  referredNewBalanceEur: number;
}): Promise<{ referrerSent: boolean; referredSent: boolean }> {
  const refShareUrl = buildPublicReferralLink(params.brand.domain, params.referrerCode, params.brand.brandName);
  const amtPadrino = params.referrerRewardEur.toFixed(2).replace('.', ',');
  const balPadrino = params.referrerNewBalanceEur.toFixed(2).replace('.', ',');
  const referrerShareCtaHtml = refShareUrl
    ? `<p>¿Quieres seguir sumando ahorro? Comparte tu enlace directo con más amigos o familiares:</p>
      <p style="margin:14px 0;"><a href="${refShareUrl}" style="display:inline-block;padding:11px 18px;background:#0F172A;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Código ${params.referrerCode} · Invitar a otro amigo</a></p>`
    : `<p>¿Quieres seguir sumando ahorro? Comparte tu código personal <strong>${params.referrerCode}</strong> con más amigos o familiares.</p>`;

  const referrerHtml = wrapEmailLayout({
    brand: params.brand,
    badge: 'Plan Amigo · Saldo Desbloqueado',
    title: `¡Ya tienes +${amtPadrino} € disponibles en tu monedero!`,
    bodyHtml: `
      <p>Hola <strong>${params.referrerName}</strong>,</p>
      <p>El suministro de tu amigo recomendado ya está activo y consolidado. Hemos abonado tu recompensa en tu monedero <strong>Plan Amigo</strong>:</p>
      <div style="margin:20px 0;padding:18px;border-radius:12px;background:#ECFDF5;border:1px solid #A7F3D0;">
        <div style="font-size:13px;color:#065F46;">Abono añadido hoy: <strong>+${amtPadrino} €</strong></div>
        <div style="font-size:24px;font-weight:800;color:#064E3B;margin-top:4px;">Saldo disponible: ${balPadrino} €</div>
        <div style="font-size:12px;color:#047857;margin-top:6px;">Se descontará de forma 100 % automática en tu próxima factura eléctrica (dejando tu recibo hasta en 0,00 € y guardando el resto para las siguientes).</div>
      </div>
      ${referrerShareCtaHtml}
    `,
  });

  const amtInvitado = params.referredRewardEur.toFixed(2).replace('.', ',');
  const balInvitado = params.referredNewBalanceEur.toFixed(2).replace('.', ',');
  const ownShareBlock = params.referredOwnCode
    ? (() => {
        const ownUrl = buildPublicReferralLink(params.brand.domain, params.referredOwnCode, params.brand.brandName);
        const ownLinkHtml = ownUrl
          ? `Compártelo y seguid ahorrando juntos: <a href="${ownUrl}" style="color:#0284C7;font-weight:600;">${ownUrl}</a>`
          : `Compártelo con tus amigos y familiares para seguir ahorrando juntos.`;
        return `
          <div style="margin-top:20px;padding:16px;border-radius:12px;background:#F8FAFC;border:1px solid #E2E8F0;">
            <div style="font-size:13px;font-weight:700;color:#0F172A;">¡Ahora tú también tienes tu propio código Plan Amigo!</div>
            <div style="font-size:18px;font-family:monospace;font-weight:800;color:#0F172A;margin:6px 0;">${params.referredOwnCode}</div>
            <div style="font-size:13px;color:#475569;">${ownLinkHtml}</div>
          </div>`;
      })()
    : '';

  const referredHtml = wrapEmailLayout({
    brand: params.brand,
    badge: 'Plan Amigo · Bienvenida Confirmada',
    title: `¡Bienvenido/a! Tus ${amtInvitado} € de bienvenida ya están activos`,
    bodyHtml: `
      <p>Hola <strong>${params.referredName}</strong>,</p>
      <p>Tu suministro ya está activo con <strong>${params.brand.brandName}</strong> y hemos acreditado tu regalo de bienvenida del <strong>Plan Amigo</strong>:</p>
      <div style="margin:20px 0;padding:18px;border-radius:12px;background:#ECFDF5;border:1px solid #A7F3D0;">
        <div style="font-size:24px;font-weight:800;color:#064E3B;">Saldo disponible: ${balInvitado} €</div>
        <div style="font-size:12px;color:#047857;margin-top:6px;">Lo descontaremos automáticamente sobre el importe a pagar de tu próxima factura eléctrica.</div>
      </div>
      ${ownShareBlock}
    `,
  });

  const [referrerSent, referredSent] = await Promise.all([
    params.referrerRewardEur > 0
      ? sendReferralHtmlEmail({
          brand: params.brand,
          to: params.referrerEmail,
          subject: `¡Ya tienes +${amtPadrino} € en tu monedero Plan Amigo!`,
          html: referrerHtml,
        })
      : Promise.resolve(false),
    params.referredRewardEur > 0
      ? sendReferralHtmlEmail({
          brand: params.brand,
          to: params.referredEmail,
          subject: `¡Tus ${amtInvitado} € de bienvenida Plan Amigo ya están disponibles!`,
          html: referredHtml,
        })
      : Promise.resolve(false),
  ]);

  return { referrerSent, referredSent };
}

export async function sendClientPersonalReferralCodeEmail(params: {
  brand: ReferralBrandEmailInfo;
  clientEmail: string | null | undefined;
  clientName: string;
  referralCode: string;
  referrerRewardEur: number;
  referredRewardEur: number;
}): Promise<boolean> {
  const shareUrl = buildPublicReferralLink(params.brand.domain, params.referralCode, params.brand.brandName);
  const waText = encodeURIComponent(
    `¡Pásate a ${params.brand.brandName} con mi código ${params.referralCode} y nos regalan ${params.referredRewardEur} € en la factura de luz a cada uno!${shareUrl ? ` ${shareUrl}` : ''}`
  );
  const waUrl = `https://wa.me/?text=${waText}`;
  const shareUrlBlock = shareUrl
    ? `<p>Comparte directamente tu enlace personalizado:</p>
      <p style="word-break:break-all;font-size:13px;background:#F1F5F9;padding:10px 12px;border-radius:8px;">
        <a href="${shareUrl}" style="color:#0F172A;font-weight:600;">${shareUrl}</a>
      </p>`
    : '';

  const html = wrapEmailLayout({
    brand: params.brand,
    badge: 'Plan Amigo · Tu Código Personal',
    title: `Invita a tus amigos y ganad ${params.referrerRewardEur} € cada uno`,
    bodyHtml: `
      <p>Hola <strong>${params.clientName}</strong>,</p>
      <p>Por ser cliente de <strong>${params.brand.brandName}</strong>, aquí tienes tu código personal del <strong>Plan Amigo</strong>:</p>
      <div style="margin:20px 0;padding:20px;text-align:center;border-radius:14px;background:#F8FAFC;border:2px dashed #CBD5E1;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748B;font-weight:700;">Tu código exclusivo</div>
        <div style="font-size:28px;font-family:monospace;font-weight:800;color:#0F172A;margin:6px 0;">${params.referralCode}</div>
        <div style="font-size:13px;color:#475569;"><strong>+${params.referrerRewardEur} €</strong> para ti y <strong>+${params.referredRewardEur} €</strong> para tu amigo en factura eléctrica</div>
      </div>
      ${shareUrlBlock}
      <p style="margin-top:18px;">
        <a href="${waUrl}" style="display:inline-block;padding:11px 18px;background:#16A34A;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Compartir por WhatsApp</a>
      </p>
    `,
  });

  return sendReferralHtmlEmail({
    brand: params.brand,
    to: params.clientEmail,
    subject: `Tu código Plan Amigo de ${params.brand.brandName}: ${params.referralCode}`,
    html,
  });
}
