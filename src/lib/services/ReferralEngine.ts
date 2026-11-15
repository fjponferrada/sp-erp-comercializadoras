import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import type {
  BrandReferralConfig,
  Prisma,
  ReferralStatus,
  ReferralTriggerMilestone,
  WalletTxType,
} from '@prisma/client';
import {
  buildPublicReferralLink,
  sendReferralRewardedEmails,
  sendReferrerInviteSignedEmail,
  type ReferralBrandEmailInfo,
} from './referralEmails';
import { isInternalBillingProductionEnabled } from './internalInvoiceMapper';

/** Tope fiscal máximo anual por Padrino exento de retención/ingreso a cuenta IRPF (Art. 75.3.f RIRPF). */
export const MAX_LEGAL_ANNUAL_REFERRAL_EUR = 300.0;

const UNAMBIGUOUS_ALPHANUM = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const UNAMBIGUOUS_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export type ReferralValidationErrorCode =
  | 'PROGRAM_DISABLED'
  | 'CODE_NOT_FOUND'
  | 'REFERRER_INACTIVE'
  | 'TARIFF_NOT_ALLOWED'
  | 'SELF_REFERRAL_NOT_ALLOWED'
  | 'SAME_IBAN_NOT_ALLOWED'
  | 'CUPS_RECENTLY_ACTIVE'
  | 'MAX_ANNUAL_LIMIT_REACHED';

export interface ReferralValidationResult {
  valid: boolean;
  errorCode?: ReferralValidationErrorCode;
  message?: string;
  normalizedCode?: string;
  referrerClient?: {
    id: string;
    vatNumber: string;
    businessName: string;
    firstName: string | null;
    lastName: string | null;
    contactEmail: string | null;
    displayNameMasked: string;
  };
  referrerRewardEur?: number;
  referredRewardEur?: number;
  config?: BrandReferralConfig;
}

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function normalizeVatClean(vat?: string | null): string {
  return String(vat || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function normalizeIbanClean(iban?: string | null): string {
  return String(iban || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function normalizeCups20(cups?: string | null): string {
  const clean = String(cups || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
  return clean.length >= 20 ? clean.slice(0, 20) : clean;
}

/**
 * Enmascara el nombre del Padrino cumpliendo RGPD estricto:
 * - Persona física ("Juan Carlos Pérez Gómez") -> "Juan C." o "Juan P."
 * - Empresa ("PANADERIA ARTESANA DEL SUR SL") -> "Panadería A."
 * Jamás expone NIF, apellidos completos, email, dirección ni teléfono.
 */
export function maskReferrerDisplayName(client: {
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  clientType?: string | null;
  vatNumber?: string | null;
}): string {
  const toTitle = (w: string) =>
    w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';

  const first = (client.firstName || '').trim();
  const last = (client.lastName || '').trim();

  if (first) {
    const firstParts = first.split(/\s+/).filter(Boolean);
    const mainFirst = toTitle(firstParts[0]);
    const initialSource = last || firstParts[1] || '';
    const init = initialSource ? ` ${initialSource.charAt(0).toUpperCase()}.` : '';
    return `${mainFirst}${init}`;
  }

  const rawBiz = (client.businessName || '')
    .replace(/\b(S\.?L\.?U?\.?|S\.?A\.?U?\.?|S\.?C\.?P\.?|C\.?B\.?|SOCIEDAD LIMITADA|COMUNIDAD DE PROPIETARIOS|C\.?P\.?)\b/gi, '')
    .replace(/[.,\-_/]+/g, ' ')
    .trim();

  const words = rawBiz.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Cliente Verificado';
  if (words.length === 1) return toTitle(words[0]);
  return `${toTitle(words[0])} ${words[1].charAt(0).toUpperCase()}.`;
}

function extractCleanCodeStem(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(SLU|SL|SAU|SA|CB|CP|DE|LA|EL|LOS|LAS|DEL|Y)\b/g, ' ')
    .replace(/[^A-Z]/g, '');

  const safeChars = ascii.replace(/[OIL]/g, (c) => (c === 'O' ? 'Q' : c === 'I' ? 'J' : 'K'));
  if (safeChars.length >= 4) return safeChars.slice(0, 4);

  let padded = safeChars;
  while (padded.length < 4) {
    padded += UNAMBIGUOUS_LETTERS[randomInt(0, UNAMBIGUOUS_LETTERS.length)];
  }
  return padded;
}

function randomUnambiguousSuffix(len = 4): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += UNAMBIGUOUS_ALPHANUM[randomInt(0, UNAMBIGUOUS_ALPHANUM.length)];
  }
  return out;
}

export function computeRewardsForTariff(
  config: Pick<
    BrandReferralConfig,
    'referrerRewardEur' | 'referredRewardEur' | 'referrerReward30tdEur' | 'referredReward30tdEur'
  >,
  tariff?: string | null
): { referrerRewardEur: number; referredRewardEur: number } {
  const t = String(tariff || '2.0TD').trim().toUpperCase();
  const isHighTariff = t.startsWith('3.') || t.startsWith('6.');

  const referrerRewardEur =
    isHighTariff && config.referrerReward30tdEur !== null && config.referrerReward30tdEur !== undefined
      ? round2(config.referrerReward30tdEur)
      : round2(config.referrerRewardEur);

  const referredRewardEur =
    isHighTariff && config.referredReward30tdEur !== null && config.referredReward30tdEur !== undefined
      ? round2(config.referredReward30tdEur)
      : round2(config.referredRewardEur);

  return { referrerRewardEur, referredRewardEur };
}

export async function getOrCreateBrandReferralConfig(brandId: string): Promise<BrandReferralConfig> {
  const existing = await prisma.brandReferralConfig.findUnique({ where: { brandId } });
  if (existing) return existing;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { codigoMarca: true, name: true },
  });

  const rawPrefix = (brand?.codigoMarca || brand?.name?.slice(0, 3) || 'AMIGO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const codePrefix = `${rawPrefix || 'AMIGO'}-`;

  return prisma.brandReferralConfig.create({
    data: {
      brandId,
      isEnabled: false,
      codePrefix,
      referrerRewardEur: 25,
      referredRewardEur: 25,
      allowedTariffs: ['2.0TD', '3.0TD'],
      triggerMilestone: 'ON_DAYS_ACTIVE',
      minActiveDays: 15,
      cooldownMonthsSameCups: 12,
      allowSelfReferral: false,
      blockSameIban: true,
      maxReferralsPerYear: 12,
      maxAnnualRewardEur: MAX_LEGAL_ANNUAL_REFERRAL_EUR,
      creditExpirationMonths: 24,
      zeroChannelCommission: true,
    },
  });
}

/**
 * Genera y persiste un `referralCode` único por marca en `Client` si aún no lo tiene.
 */
export async function ensureClientReferralCode(
  clientId: string,
  txClient?: Prisma.TransactionClient
): Promise<string | null> {
  const db = txClient || prisma;
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      brand: {
        include: { referralConfig: true },
      },
    },
  });
  if (!client) return null;
  if (client.referralCode) return client.referralCode;

  let prefix = client.brand?.referralConfig?.codePrefix?.trim().toUpperCase() || '';
  if (!prefix) {
    const rawBrandCode = (client.brand?.codigoMarca || client.brand?.name?.slice(0, 3) || 'AMIGO')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    prefix = `${rawBrandCode || 'AMIGO'}-`;
  }
  if (!prefix.endsWith('-')) prefix = `${prefix}-`;

  const stemSource = client.firstName || client.businessName || 'AMIG';
  const stem = extractCleanCodeStem(stemSource);

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `${prefix}${stem}${randomUnambiguousSuffix(4)}`;
    const collision = await db.client.findFirst({
      where: { brandId: client.brandId, referralCode: candidate },
      select: { id: true },
    });
    if (!collision) {
      const updated = await db.client.update({
        where: { id: client.id },
        data: { referralCode: candidate },
        select: { referralCode: true },
      });
      return updated.referralCode;
    }
  }

  const fallback = `${prefix}${randomUnambiguousSuffix(8)}`;
  const updated = await db.client.update({
    where: { id: client.id },
    data: { referralCode: fallback },
    select: { referralCode: true },
  });
  return updated.referralCode;
}

/**
 * Genera masivamente códigos Plan Amigo para todos los clientes con al menos un contrato activo/vigente de una marca.
 */
export async function backfillBrandReferralCodes(brandId: string): Promise<{ generatedCount: number }> {
  await getOrCreateBrandReferralConfig(brandId);

  const eligibleClients = await prisma.client.findMany({
    where: {
      brandId,
      referralCode: null,
      contracts: {
        some: {
          status: { in: ['ACTIVO', 'Activo', 'ACEPTADO', 'Aceptado', 'TRAMITADO', 'FIRMADO'] },
        },
      },
    },
    select: { id: true },
  });

  let generatedCount = 0;
  for (const c of eligibleClients) {
    const code = await ensureClientReferralCode(c.id);
    if (code) generatedCount++;
  }

  return { generatedCount };
}

/**
 * Comprueba si un cliente Padrino mantiene al menos 1 suministro vigente en la marca (respetando Regla 47 de renovaciones).
 */
export async function isReferrerCurrentlyActiveInBrand(
  clientId: string,
  brandId: string,
  txClient?: Prisma.TransactionClient
): Promise<boolean> {
  const db = txClient || prisma;
  const activeCount = await db.contract.count({
    where: {
      clientId,
      OR: [{ brandId }, { client: { brandId } }],
      status: { in: ['ACTIVO', 'Activo'] },
    },
  });
  if (activeCount > 0) return true;

  // Regla 47: también válido si está en transición firme de renovación (tipo 'R' ACEPTADO / TRAMITADO)
  const activeRenewalCount = await db.contract.count({
    where: {
      clientId,
      OR: [{ brandId }, { client: { brandId } }],
      tipo: 'R',
      status: { in: ['ACEPTADO', 'Aceptado', 'TRAMITADO'] },
    },
  });
  return activeRenewalCount > 0;
}

/**
 * Validador central de elegibilidad y antifraude Plan Amigo (Sección 4 de la especificación).
 */
export async function validateReferralEligibility(params: {
  brandId: string;
  code: string;
  tariff?: string | null;
  cups?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
}): Promise<ReferralValidationResult> {
  const normalizedCode = String(params.code || '')
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    return {
      valid: false,
      errorCode: 'CODE_NOT_FOUND',
      message: 'Introduce un código de invitación válido.',
    };
  }

  const config = await prisma.brandReferralConfig.findUnique({
    where: { brandId: params.brandId },
  });

  // 1. Programa activo en la marca
  if (!config || !config.isEnabled) {
    return {
      valid: false,
      errorCode: 'PROGRAM_DISABLED',
      message: 'El programa Plan Amigo no se encuentra activo actualmente en esta marca.',
    };
  }

  // 2. Existencia y vigencia del código del Padrino en la misma marca
  const referrer = await prisma.client.findFirst({
    where: {
      brandId: params.brandId,
      referralCode: { equals: normalizedCode, mode: 'insensitive' },
    },
    include: {
      contracts: {
        select: { id: true, status: true, tipo: true, iban: true },
      },
      supplyPoints: {
        select: { iban: true },
      },
    },
  });

  if (!referrer || !referrer.referralCodeActive) {
    return {
      valid: false,
      errorCode: 'CODE_NOT_FOUND',
      message: 'El código Plan Amigo introducido no existe o ya no está habilitado.',
    };
  }

  const referrerActive = await isReferrerCurrentlyActiveInBrand(referrer.id, params.brandId);
  if (!referrerActive) {
    return {
      valid: false,
      errorCode: 'REFERRER_INACTIVE',
      message: 'El titular de este código ya no mantiene un suministro activo con nosotros.',
    };
  }

  // 3. Tarifa permitida
  if (params.tariff && params.tariff.trim()) {
    const normTariff = params.tariff.trim().toUpperCase();
    const allowed = (config.allowedTariffs || []).map((t) => t.trim().toUpperCase());
    if (allowed.length > 0 && !allowed.includes(normTariff)) {
      return {
        valid: false,
        errorCode: 'TARIFF_NOT_ALLOWED',
        message: `El Plan Amigo aplica únicamente a suministros con tarifa ${allowed.join(' o ')}.`,
      };
    }
  }

  // 4. Control de auto-recomendación (mismo NIF/CIF)
  if (!config.allowSelfReferral && params.vatNumber && params.vatNumber.trim()) {
    const inVat = normalizeVatClean(params.vatNumber);
    const refVat = normalizeVatClean(referrer.vatNumber);
    if (inVat && refVat && inVat === refVat) {
      return {
        valid: false,
        errorCode: 'SELF_REFERRAL_NOT_ALLOWED',
        message: 'El Plan Amigo aplica a nuevos titulares distintos de la persona que invita.',
      };
    }
  }

  // 5. Control de mismo IBAN
  if (config.blockSameIban && params.iban && params.iban.trim()) {
    const inIban = normalizeIbanClean(params.iban);
    if (inIban.length >= 16) {
      const referrerIbans = new Set<string>();
      for (const c of referrer.contracts) {
        const clean = normalizeIbanClean(c.iban);
        if (clean) referrerIbans.add(clean);
      }
      for (const sp of referrer.supplyPoints) {
        const clean = normalizeIbanClean(sp.iban);
        if (clean) referrerIbans.add(clean);
      }
      if (referrerIbans.has(inIban)) {
        return {
          valid: false,
          errorCode: 'SAME_IBAN_NOT_ALLOWED',
          message:
            'La cuenta bancaria domiciliada coincide con la del padrino. El Plan Amigo requiere titulares y cuentas independientes.',
        };
      }
    }
  }

  // 6. Control anti-rotación de CUPS (cooldownMonthsSameCups) y unicidad por CUPS en trámite
  if (params.cups && params.cups.trim()) {
    const cups20 = normalizeCups20(params.cups);
    if (cups20.length >= 20) {
      const existingActiveReferral = await prisma.referral.findFirst({
        where: {
          brandId: params.brandId,
          referredCups: { startsWith: cups20 },
          status: { in: ['PENDING_SIGNATURE', 'PENDING_ACTIVATION', 'REWARDED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const cooldownMonths = Math.max(0, config.cooldownMonthsSameCups ?? 12);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - cooldownMonths);

      if (
        existingActiveReferral &&
        (existingActiveReferral.status !== 'REWARDED' || existingActiveReferral.createdAt >= cutoffDate)
      ) {
        return {
          valid: false,
          errorCode: 'CUPS_RECENTLY_ACTIVE',
          message: 'Este punto de suministro (CUPS) ya cuenta con una promoción Plan Amigo registrada.',
        };
      }

      if (cooldownMonths > 0) {
        const recentContract = await prisma.contract.findFirst({
          where: {
            OR: [{ brandId: params.brandId }, { client: { brandId: params.brandId } }],
            supplyPoint: { cups: { startsWith: cups20 } },
            status: { in: ['ACTIVO', 'Activo', 'FINALIZADO', 'Finalizado', 'BAJA', 'Baja'] },
            AND: [
              {
                OR: [
                  { status: { in: ['ACTIVO', 'Activo'] } },
                  { terminationDate: { gte: cutoffDate } },
                  { activationDate: { gte: cutoffDate } },
                ],
              },
            ],
          },
          select: { id: true },
        });

        if (recentContract) {
          return {
            valid: false,
            errorCode: 'CUPS_RECENTLY_ACTIVE',
            message: `Este suministro ya ha estado activo en nuestra comercializadora durante los últimos ${cooldownMonths} meses.`,
          };
        }
      }
    }
  }

  // 7. Tope anual por Padrino (unidades e importe máximo fiscal de 300,00 € / año Art. 75.3.f RIRPF)
  const yearStart = getMadridCalendarYearStartUtc();
  if (config.maxReferralsPerYear !== null && config.maxReferralsPerYear !== undefined) {
    const countThisYear = await prisma.referral.count({
      where: {
        brandId: params.brandId,
        referrerClientId: referrer.id,
        status: { in: ['PENDING_SIGNATURE', 'PENDING_ACTIVATION', 'REWARDED'] },
        createdAt: { gte: yearStart },
      },
    });

    if (countThisYear >= config.maxReferralsPerYear) {
      return {
        valid: false,
        errorCode: 'MAX_ANNUAL_LIMIT_REACHED',
        message: 'Este código ya ha alcanzado el límite máximo anual de invitaciones permitidas en las bases legales.',
      };
    }
  }

  const effectiveMaxAnnualEur = resolveEffectiveMaxAnnualEur(config.maxAnnualRewardEur);
  const usedOrCommittedEur = await getReferrerAnnualCommittedOrCreditedEur(
    prisma,
    params.brandId,
    referrer.id,
    yearStart
  );
  const remainingAnnualEur = round2(effectiveMaxAnnualEur - usedOrCommittedEur);

  if (remainingAnnualEur <= 0) {
    return {
      valid: false,
      errorCode: 'MAX_ANNUAL_LIMIT_REACHED',
      message: `Este código ya ha alcanzado el límite máximo anual de ${effectiveMaxAnnualEur.toFixed(2).replace('.', ',')} € en bonificaciones Plan Amigo.`,
    };
  }

  const rewards = computeRewardsForTariff(config, params.tariff);
  const cappedReferrerRewardEur = round2(Math.min(rewards.referrerRewardEur, remainingAnnualEur));

  return {
    valid: true,
    normalizedCode: referrer.referralCode || normalizedCode,
    referrerClient: {
      id: referrer.id,
      vatNumber: referrer.vatNumber,
      businessName: referrer.businessName,
      firstName: referrer.firstName,
      lastName: referrer.lastName,
      contactEmail: referrer.contactEmail,
      displayNameMasked: maskReferrerDisplayName(referrer),
    },
    referrerRewardEur: cappedReferrerRewardEur,
    referredRewardEur: rewards.referredRewardEur,
    config,
  };
}

/**
 * Devuelve el inicio del año natural en curso (1 de enero 00:00:00) en huso oficial español Europe/Madrid.
 */
export function getMadridCalendarYearStartUtc(now = new Date()): Date {
  const madridYearStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 4);
  const year = parseInt(madridYearStr, 10) || now.getUTCFullYear();
  // En enero España peninsular está siempre en CET (UTC+1) -> 00:00 CET = 31 dic 23:00 UTC
  return new Date(Date.UTC(year, 0, 1, -1, 0, 0, 0));
}

export function resolveEffectiveMaxAnnualEur(configured?: number | null): number {
  if (configured === null || configured === undefined || !Number.isFinite(Number(configured)) || Number(configured) <= 0) {
    return MAX_LEGAL_ANNUAL_REFERRAL_EUR;
  }
  return round2(Math.min(MAX_LEGAL_ANNUAL_REFERRAL_EUR, Number(configured)));
}

/**
 * Calcula el importe anual ya abonado (`CREDIT_REFERRER` en el año fiscal) más el comprometido en vuelo
 * (`PENDING_SIGNATURE` / `PENDING_ACTIVATION`) para impedir superar los 300,00 € anuales por Padrino.
 */
export async function getReferrerAnnualCommittedOrCreditedEur(
  db: Prisma.TransactionClient | typeof prisma,
  brandId: string,
  referrerClientId: string,
  yearStart = getMadridCalendarYearStartUtc()
): Promise<number> {
  const [creditedAgg, inFlightAgg] = await Promise.all([
    db.referralWalletTransaction.aggregate({
      where: {
        brandId,
        clientId: referrerClientId,
        type: 'CREDIT_REFERRER',
        createdAt: { gte: yearStart },
      },
      _sum: { amountEur: true },
    }),
    db.referral.aggregate({
      where: {
        brandId,
        referrerClientId,
        status: { in: ['PENDING_SIGNATURE', 'PENDING_ACTIVATION'] },
      },
      _sum: { referrerRewardSnapshot: true },
    }),
  ]);

  return round2(
    Math.max(0, Number(creditedAgg._sum.amountEur || 0)) +
      Math.max(0, Number(inFlightAgg._sum.referrerRewardSnapshot || 0))
  );
}

/**
 * Calcula únicamente el importe efectivamente ingresado (`CREDIT_REFERRER`) al Padrino en el año natural en curso.
 */
export async function getReferrerCreditedThisYearEur(
  db: Prisma.TransactionClient | typeof prisma,
  brandId: string,
  referrerClientId: string,
  yearStart = getMadridCalendarYearStartUtc()
): Promise<number> {
  const creditedAgg = await db.referralWalletTransaction.aggregate({
    where: {
      brandId,
      clientId: referrerClientId,
      type: 'CREDIT_REFERRER',
      createdAt: { gte: yearStart },
    },
    _sum: { amountEur: true },
  });
  return round2(Math.max(0, Number(creditedAgg._sum.amountEur || 0)));
}

/**
 * Inserta un movimiento inmutable en `ReferralWalletTransaction` adquiriendo lock de fila sobre `Client`
 * dentro de la transacción de base de datos para garantizar consistencia estricta ante concurrencia.
 */
export async function recordWalletTransactionAtomic(
  tx: Prisma.TransactionClient,
  params: {
    brandId: string;
    clientId: string;
    type: WalletTxType;
    amountEur: number;
    referralId?: string | null;
    internalInvoiceId?: string | null;
    invoiceId?: string | null;
    expiresAt?: Date | null;
    notes?: string | null;
    createdByUserId?: string | null;
  }
) {
  await tx.$queryRawUnsafe(`SELECT "id" FROM "Client" WHERE "id" = $1 FOR UPDATE`, params.clientId);

  const rows = await tx.$queryRawUnsafe<Array<{ bal: number | null }>>(
    `SELECT COALESCE(SUM("amountEur"), 0)::float8 AS bal
     FROM "ReferralWalletTransaction"
     WHERE "clientId" = $1 AND "brandId" = $2`,
    params.clientId,
    params.brandId
  );

  const currentBalance = round2(Number(rows?.[0]?.bal || 0));
  const delta = round2(params.amountEur);
  const nextBalance = round2(Math.max(0, currentBalance + delta));

  // Si es una deducción/caducidad y superase por redondeo el saldo disponible, la acotamos
  const effectiveAmount = delta < 0 ? round2(Math.max(-currentBalance, delta)) : delta;
  if (delta < 0 && effectiveAmount === 0) {
    return null;
  }

  return tx.referralWalletTransaction.create({
    data: {
      brandId: params.brandId,
      clientId: params.clientId,
      referralId: params.referralId || null,
      internalInvoiceId: params.internalInvoiceId || null,
      invoiceId: params.invoiceId || null,
      type: params.type,
      amountEur: effectiveAmount,
      balanceAfterEur: round2(currentBalance + effectiveAmount),
      expiresAt: params.expiresAt || null,
      notes: params.notes || null,
      createdByUserId: params.createdByUserId || null,
    },
  });
}

/**
 * Caduca automáticamente abonos vencidos (FIFO) si superaron su `expiresAt` y aún quedaba saldo vivo sin consumir.
 * Rastrea `expiredAmountEur` por abono positivo para impedir dobles caducidades ante reversiones (`INVOICE_REVERSAL`)
 * y evitar bloqueos `SELECT ... FOR UPDATE` innecesarios cuando el saldo es 0 o los bonos vencidos ya se liquidaron.
 */
export async function expireOverdueClientCreditsIfAny(clientId: string, brandId: string): Promise<void> {
  const precheck = await prisma.$queryRawUnsafe<Array<{ bal: number | null; cand: number | null }>>(
    `SELECT
       COALESCE(SUM("amountEur"), 0)::float8 AS bal,
       COUNT(*) FILTER (
         WHERE "amountEur" > 0
           AND "expiresAt" IS NOT NULL
           AND "expiresAt" <= NOW()
           AND COALESCE("expiredAmountEur", 0) < ("amountEur" - 0.009)
       )::int AS cand
     FROM "ReferralWalletTransaction"
     WHERE "clientId" = $1 AND "brandId" = $2`,
    clientId,
    brandId
  );

  const liveBal = round2(Number(precheck?.[0]?.bal || 0));
  const candCount = Number(precheck?.[0]?.cand || 0);
  if (liveBal <= 0.009 || candCount === 0) return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT "id" FROM "Client" WHERE "id" = $1 FOR UPDATE`, clientId);

    const allTxs = await tx.referralWalletTransaction.findMany({
      where: { clientId, brandId },
      orderBy: { createdAt: 'asc' },
    });

    const currentTotal = round2(allTxs.reduce((acc, t) => acc + t.amountEur, 0));
    if (currentTotal <= 0.009) return;

    // Consumo neto en facturas + ajustes negativos (EXCLUYENDO EXPIRATION, ya que cada abono rastrea su propio expiredAmountEur)
    let netConsumed = 0;
    const positiveGrants: Array<{
      id: string;
      amount: number;
      expiredAmount: number;
      expiresAt: Date | null;
    }> = [];

    for (const item of allTxs) {
      if (item.type === 'EXPIRATION') {
        continue;
      }
      if (item.type === 'INVOICE_REVERSAL') {
        netConsumed = round2(Math.max(0, netConsumed - Math.abs(item.amountEur)));
      } else if (item.amountEur < 0) {
        netConsumed = round2(netConsumed + Math.abs(item.amountEur));
      } else if (item.amountEur > 0) {
        positiveGrants.push({
          id: item.id,
          amount: item.amountEur,
          expiredAmount: Math.max(0, Number(item.expiredAmountEur || 0)),
          expiresAt: item.expiresAt,
        });
      }
    }

    let remainingConsumed = netConsumed;
    const pendingGrantUpdates: Array<{ id: string; prevExpired: number; maxAddExpire: number }> = [];
    let newlyExpiredSum = 0;

    for (const grant of positiveGrants) {
      const livePrincipal = round2(Math.max(0, grant.amount - grant.expiredAmount));
      const usedFromGrant = round2(Math.min(livePrincipal, remainingConsumed));
      remainingConsumed = round2(remainingConsumed - usedFromGrant);
      const unspentLive = round2(Math.max(0, livePrincipal - usedFromGrant));

      if (unspentLive > 0.009 && grant.expiresAt && grant.expiresAt <= now) {
        newlyExpiredSum = round2(newlyExpiredSum + unspentLive);
        pendingGrantUpdates.push({
          id: grant.id,
          prevExpired: grant.expiredAmount,
          maxAddExpire: unspentLive,
        });
      }
    }

    const toExpire = round2(Math.min(Math.max(0, currentTotal), newlyExpiredSum));
    if (toExpire > 0.009) {
      let leftToMark = toExpire;
      for (const upd of pendingGrantUpdates) {
        if (leftToMark <= 0.009) break;
        const applied = round2(Math.min(upd.maxAddExpire, leftToMark));
        leftToMark = round2(leftToMark - applied);
        await tx.referralWalletTransaction.update({
          where: { id: upd.id },
          data: { expiredAmountEur: round2(upd.prevExpired + applied) },
        });
      }

      await tx.referralWalletTransaction.create({
        data: {
          brandId,
          clientId,
          type: 'EXPIRATION',
          amountEur: -toExpire,
          balanceAfterEur: round2(currentTotal - toExpire),
          notes: 'Caducidad automática de saldo promocional vencido',
        },
      });
    }
  });
}

/**
 * Obtiene el saldo disponible neto (>= 0,00 €) del monedero Plan Amigo de un cliente en su marca.
 */
export async function getClientAvailableReferralBalance(
  clientId?: string | null,
  brandId?: string | null
): Promise<number> {
  if (!clientId || !brandId) return 0;

  await expireOverdueClientCreditsIfAny(clientId, brandId).catch(() => null);

  const agg = await prisma.referralWalletTransaction.aggregate({
    where: { clientId, brandId },
    _sum: { amountEur: true },
  });

  return Math.max(0, round2(Number(agg._sum.amountEur || 0)));
}

function buildBrandEmailInfo(brand: any): ReferralBrandEmailInfo {
  return {
    brandName: brand?.name || 'Comercializadora',
    companyName: brand?.company?.name || null,
    logoUrl: brand?.logoUrl || brand?.invoiceLogoUrl || null,
    accentColor: brand?.accentColor || '#1B4241',
    supportEmail: brand?.supportEmail || brand?.email || null,
    phone: brand?.freePhone900 || brand?.phone || null,
    domain: brand?.domain || null,
  };
}

/**
 * Motor idempotente de consolidación del ciclo de vida de invitaciones Plan Amigo:
 * - Puede invocarse en tiempo real tras firma PAdES (`signatureActions`), tras ingesta de Switching (`switchingIngest`)
 *   o desde el Cron diario (`/api/cron/process-referrals`).
 */
export async function reconcileReferralsLifecycle(options?: {
  brandId?: string;
  contractId?: string;
  leadId?: string;
}): Promise<{
  movedToPendingActivation: number;
  rewardedCount: number;
  cancelledCount: number;
  codesGenerated: number;
}> {
  let movedToPendingActivation = 0;
  let rewardedCount = 0;
  let cancelledCount = 0;
  let codesGenerated = 0;

  // 1. Generar referralCode automáticamente para clientes con contratos ACTIVOS en marcas con Plan Amigo habilitado
  const enabledConfigs = await prisma.brandReferralConfig.findMany({
    where: {
      isEnabled: true,
      ...(options?.brandId ? { brandId: options.brandId } : {}),
    },
    select: { brandId: true },
  });

  for (const cfg of enabledConfigs) {
    const clientsMissingCode = await prisma.client.findMany({
      where: {
        brandId: cfg.brandId,
        referralCode: null,
        contracts: {
          some: {
            status: { in: ['ACTIVO', 'Activo'] },
            ...(options?.contractId ? { id: options.contractId } : {}),
          },
        },
      },
      select: { id: true },
      take: 250,
    });
    for (const cl of clientsMissingCode) {
      const code = await ensureClientReferralCode(cl.id);
      if (code) codesGenerated++;
    }
  }

  // 2. Evaluar registros Referral abiertos (PENDING_SIGNATURE / PENDING_ACTIVATION)
  const openReferrals = await prisma.referral.findMany({
    where: {
      status: { in: ['PENDING_SIGNATURE', 'PENDING_ACTIVATION'] },
      ...(options?.brandId ? { brandId: options.brandId } : {}),
      ...(options?.contractId
        ? {
            OR: [
              { referredContractId: options.contractId },
              { referredLead: { contractId: options.contractId } },
            ],
          }
        : {}),
      ...(options?.leadId ? { referredLeadId: options.leadId } : {}),
    },
    include: {
      brand: {
        include: { company: true, referralConfig: true },
      },
      referrerClient: {
        include: {
          contracts: { select: { iban: true } },
          supplyPoints: { select: { iban: true } },
        },
      },
      referredClient: true,
      referredLead: {
        include: {
          contract: {
            include: {
              client: { select: { id: true, vatNumber: true } },
              supplyPoint: { select: { iban: true } },
              signatureEnvelopes: { select: { status: true } },
              other_Contract: { select: { id: true, status: true } },
            },
          },
        },
      },
      referredContract: {
        include: {
          client: { select: { id: true, vatNumber: true } },
          supplyPoint: { select: { iban: true } },
          signatureEnvelopes: { select: { status: true } },
          other_Contract: { select: { id: true, status: true } },
        },
      },
    },
  });

  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const ref of openReferrals) {
    let contract = ref.referredContract || ref.referredLead?.contract || null;

    // Vincular contrato/cliente si el Lead se convirtió a contrato con posterioridad
    if (!ref.referredContractId && ref.referredLead?.contractId && contract) {
      await prisma.referral
        .update({
          where: { id: ref.id },
          data: {
            referredContractId: contract.id,
            referredClientId: contract.clientId,
          },
        })
        .catch(() => null);
    }

    // Si el Lead fue descartado sin contrato, cancelar la atribución
    const leadStatusUpper = String(ref.referredLead?.status || '').toUpperCase();
    if (!contract && ['DESCARTADO', 'RECHAZADO', 'CANCELADO', 'PERDIDO'].includes(leadStatusUpper)) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason: `LEAD_${leadStatusUpper}`,
        },
      });
      cancelledCount++;
      continue;
    }

    if (!contract) continue;

    const cStatusUpper = String(contract.status || '').trim().toUpperCase();
    const hasSuccessorActive =
      contract.other_Contract &&
      ['ACTIVO', 'ACEPTADO', 'TRAMITADO'].includes(String(contract.other_Contract.status || '').toUpperCase());

    // A) Comprobar si el contrato sufrió rechazo ATR, anulación, desistimiento E1 o baja prematura antes de consolidar
    if (
      ['RECHAZADO', 'CANCELADO', 'ANULADO', 'BAJA', 'FINALIZADO'].includes(cStatusUpper) &&
      !hasSuccessorActive
    ) {
      const bajaProc = String(contract.bajaProcess || '').toUpperCase();
      let reason = `CONTRATO_${cStatusUpper}`;
      if (cStatusUpper === 'RECHAZADO') reason = 'RECHAZO_ATR';
      else if (bajaProc === 'E1') reason = 'DESISTIMIENTO_E1';
      else if (cStatusUpper === 'BAJA' || cStatusUpper === 'FINALIZADO') reason = 'BAJA_PREMATURA';

      await prisma.referral.update({
        where: { id: ref.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason: reason,
        },
      });
      cancelledCount++;
      continue;
    }

    // B) Pasar de PENDING_SIGNATURE -> PENDING_ACTIVATION cuando ya está firmado o en trámite/activo
    const hasSignedEnvelope = contract.signatureEnvelopes?.some((e) => e.status === 'SIGNED');
    const isContractSignedOrBeyond =
      Boolean(hasSignedEnvelope) ||
      Boolean(contract.filePdfSigned) ||
      Boolean(contract.signatureDate) ||
      ['FIRMADO', 'TRAMITADO', 'ACEPTADO', 'ACTIVO'].includes(cStatusUpper);

    let currentStatus: ReferralStatus = ref.status;
    if (currentStatus === 'PENDING_SIGNATURE' && isContractSignedOrBeyond) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: { status: 'PENDING_ACTIVATION' },
      });
      currentStatus = 'PENDING_ACTIVATION';
      movedToPendingActivation++;
    }

    if (
      currentStatus === 'PENDING_ACTIVATION' &&
      !ref.inviteSignedEmailSentAt &&
      cStatusUpper !== 'ACTIVO'
    ) {
      const referredNameObj = ref.referredClient || {
        businessName: ref.referredLead?.businessName || 'Tu amigo',
      };
      const sent = await sendReferrerInviteSignedEmail({
        brand: buildBrandEmailInfo(ref.brand),
        referrerEmail: ref.referrerClient.contactEmail,
        referrerName: ref.referrerClient.firstName || ref.referrerClient.businessName,
        referredMaskedName: maskReferrerDisplayName(referredNameObj),
        rewardEur: ref.referrerRewardSnapshot,
        minActiveDays: ref.minActiveDaysSnap,
      });
      await prisma.referral.update({
        where: { id: ref.id },
        data: { inviteSignedEmailSentAt: sent ? now : new Date() },
      });
    }

    // C) Evaluar si el contrato ya cumple el hito de consolidación para liberar los abonos
    if (cStatusUpper !== 'ACTIVO') continue;

    let milestoneMet = false;
    const milestone: ReferralTriggerMilestone = ref.triggerMilestoneSnap;

    if (milestone === 'ON_ATR_ACTIVATION') {
      milestoneMet = true;
    } else if (milestone === 'ON_DAYS_ACTIVE') {
      const actDate = contract.activationDate || contract.updatedAt;
      const daysActive = Math.floor((now.getTime() - new Date(actDate).getTime()) / DAY_MS);
      milestoneMet = daysActive >= Math.max(0, ref.minActiveDaysSnap);
    } else if (milestone === 'ON_FIRST_ISSUED_INVOICE') {
      const prodInternal = isInternalBillingProductionEnabled();
      const [intCount, legCount] = await Promise.all([
        prodInternal
          ? prisma.internalInvoice.count({
              where: { contractId: contract.id, status: 'EMITIDA', totalAmount: { gt: 0 } },
            })
          : Promise.resolve(0),
        prisma.invoice.count({
          where: {
            contractId: contract.id,
            totalAmount: { gt: 0 },
            NOT: { invoiceType: 'Abono' },
          },
        }),
      ]);
      milestoneMet = intCount + legCount > 0;
    }

    if (!milestoneMet) continue;

    // Re-verificación antifraude final (NIF e IBAN reales del contrato en firme, cubriendo Leads creados en 2 pasos)
    const brandCfg = ref.brand?.referralConfig;
    const referredVat = normalizeVatClean(
      contract.client?.vatNumber || ref.referredClient?.vatNumber || ref.referredLead?.vatNumber
    );
    const referrerVat = normalizeVatClean(ref.referrerClient.vatNumber);
    if (!brandCfg?.allowSelfReferral && referredVat && referrerVat && referredVat === referrerVat) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason: 'AUTOCONTRATACION_NIF',
        },
      });
      cancelledCount++;
      continue;
    }

    if (brandCfg?.blockSameIban !== false) {
      const contractIban = normalizeIbanClean(contract.iban || contract.supplyPoint?.iban);
      if (contractIban.length >= 16) {
        const refIbans = new Set<string>();
        for (const rc of ref.referrerClient.contracts || []) {
          const clean = normalizeIbanClean(rc.iban);
          if (clean) refIbans.add(clean);
        }
        for (const rsp of ref.referrerClient.supplyPoints || []) {
          const clean = normalizeIbanClean(rsp.iban);
          if (clean) refIbans.add(clean);
        }
        if (refIbans.has(contractIban)) {
          await prisma.referral.update({
            where: { id: ref.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
              cancelReason: 'MISMO_IBAN_PADRINO',
            },
          });
          cancelledCount++;
          continue;
        }
      }
    }

    // Verificar que el Padrino sigue teniendo al menos 1 contrato ACTIVO en la marca en el momento de consolidar
    const referrerStillActive = await isReferrerCurrentlyActiveInBrand(ref.referrerClientId, ref.brandId);
    if (!referrerStillActive) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason: 'PADRINO_SIN_CONTRATO_ACTIVO',
        },
      });
      cancelledCount++;
      continue;
    }

    const referredClientId = ref.referredClientId || contract.clientId;
    const expMonths = ref.brand?.referralConfig?.creditExpirationMonths ?? 24;
    let expiresAt: Date | null = null;
    if (expMonths && expMonths > 0) {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + expMonths);
    }

    const effectiveMaxAnnualEur = resolveEffectiveMaxAnnualEur(
      ref.brand?.referralConfig?.maxAnnualRewardEur
    );
    const yearStart = getMadridCalendarYearStartUtc(now);

    // Liberación transaccional e idempotente de los 2 abonos en el Ledger
    let rewardOutcome: {
      referrerBal: number;
      referredBal: number;
      effectiveReferrerRewardEur: number;
      referrerCode: string;
      referredOwnCode: string | null;
      referredClientRecord: any;
    } | null = null;

    await prisma.$transaction(async (tx) => {
      const freshRef = await tx.referral.findUnique({ where: { id: ref.id } });
      if (!freshRef || freshRef.status === 'REWARDED' || freshRef.status === 'CANCELLED') {
        return;
      }

      await tx.$queryRawUnsafe(`SELECT "id" FROM "Client" WHERE "id" = $1 FOR UPDATE`, ref.referrerClientId);
      const creditedThisYear = await getReferrerCreditedThisYearEur(
        tx,
        ref.brandId,
        ref.referrerClientId,
        yearStart
      );
      const remainingReferrerCap = round2(Math.max(0, effectiveMaxAnnualEur - creditedThisYear));
      const effectiveReferrerRewardEur = round2(
        Math.min(Math.max(0, freshRef.referrerRewardSnapshot), remainingReferrerCap)
      );

      const referrerCode = (await ensureClientReferralCode(ref.referrerClientId, tx)) || ref.referralCodeUsed;
      const referredOwnCode = await ensureClientReferralCode(referredClientId, tx);
      const referredClientRecord = await tx.client.findUnique({ where: { id: referredClientId } });

      let referrerTx = null;
      if (effectiveReferrerRewardEur > 0) {
        const capNote =
          effectiveReferrerRewardEur < freshRef.referrerRewardSnapshot
            ? ` (acotado al tope anual de ${effectiveMaxAnnualEur.toFixed(2)} €)`
            : '';
        referrerTx = await recordWalletTransactionAtomic(tx, {
          brandId: ref.brandId,
          clientId: ref.referrerClientId,
          referralId: ref.id,
          type: 'CREDIT_REFERRER',
          amountEur: effectiveReferrerRewardEur,
          expiresAt,
          notes: `Bonificación Plan Amigo por alta activa CUPS ${ref.referredCups.slice(0, 20)}${capNote}`,
        });
      }

      let referredTx = null;
      if (freshRef.referredRewardSnapshot > 0) {
        referredTx = await recordWalletTransactionAtomic(tx, {
          brandId: ref.brandId,
          clientId: referredClientId,
          referralId: ref.id,
          type: 'CREDIT_REFERRED',
          amountEur: freshRef.referredRewardSnapshot,
          expiresAt,
          notes: `Bienvenida Plan Amigo con código ${ref.referralCodeUsed}`,
        });
      }

      await tx.referral.update({
        where: { id: ref.id },
        data: {
          referredClientId,
          referredContractId: contract!.id,
          status: 'REWARDED',
          qualifiedAt: now,
          rewardedAt: now,
        },
      });

      rewardOutcome = {
        referrerBal: referrerTx?.balanceAfterEur ?? 0,
        referredBal: referredTx?.balanceAfterEur ?? 0,
        effectiveReferrerRewardEur,
        referrerCode,
        referredOwnCode,
        referredClientRecord,
      };
    });

    if (rewardOutcome) {
      rewardedCount++;
      const ro = rewardOutcome as {
        referrerBal: number;
        referredBal: number;
        effectiveReferrerRewardEur: number;
        referrerCode: string;
        referredOwnCode: string | null;
        referredClientRecord: any;
      };

      await sendReferralRewardedEmails({
        brand: buildBrandEmailInfo(ref.brand),
        referrerEmail: ref.referrerClient.contactEmail,
        referrerName: ref.referrerClient.firstName || ref.referrerClient.businessName,
        referrerCode: ro.referrerCode,
        referrerRewardEur: ro.effectiveReferrerRewardEur,
        referrerNewBalanceEur: ro.referrerBal,
        referredEmail: ro.referredClientRecord?.contactEmail || ref.referredLead?.email,
        referredName:
          ro.referredClientRecord?.firstName ||
          ro.referredClientRecord?.businessName ||
          ref.referredLead?.businessName ||
          'Cliente',
        referredOwnCode: ro.referredOwnCode,
        referredRewardEur: ref.referredRewardSnapshot,
        referredNewBalanceEur: ro.referredBal,
      }).catch((e) => console.warn('[PLAN AMIGO] Aviso email recompensa no enviado:', e));

      await prisma.referral
        .update({
          where: { id: ref.id },
          data: { rewardEmailSentAt: new Date() },
        })
        .catch(() => null);
    }
  }

  return {
    movedToPendingActivation,
    rewardedCount,
    cancelledCount,
    codesGenerated,
  };
}

export { buildPublicReferralLink };
