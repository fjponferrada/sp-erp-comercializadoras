'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';
import {
  backfillBrandReferralCodes,
  buildPublicReferralLink,
  ensureClientReferralCode,
  getClientAvailableReferralBalance,
  getMadridCalendarYearStartUtc,
  getOrCreateBrandReferralConfig,
  getReferrerCreditedThisYearEur,
  maskReferrerDisplayName,
  MAX_LEGAL_ANNUAL_REFERRAL_EUR,
  reconcileReferralsLifecycle,
  recordWalletTransactionAtomic,
  resolveEffectiveMaxAnnualEur,
  round2,
} from '@/lib/services/ReferralEngine';
import { sendClientPersonalReferralCodeEmail } from '@/lib/services/referralEmails';
import type { ReferralStatus, ReferralTriggerMilestone } from '@prisma/client';

function buildClientEmailMatchOr(cleanEmail: string) {
  return [
    { contactEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
    { invoiceEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
    { contactEmail2: { equals: cleanEmail, mode: 'insensitive' as const } },
    { contactEmail3: { equals: cleanEmail, mode: 'insensitive' as const } },
    { representativeEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
  ];
}

export async function getBrandReferralSettingsAction(explicitBrandId?: string) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    return { success: false, error: 'No autorizado' };
  }

  const targetBrandId = explicitBrandId || access.activeBrandId;
  if (!targetBrandId || !access.canAccessBrand(targetBrandId)) {
    return { success: false, error: 'Marca no autorizada' };
  }

  const [config, activeClientsWithoutCodeCount, brand] = await Promise.all([
    getOrCreateBrandReferralConfig(targetBrandId),
    prisma.client.count({
      where: {
        brandId: targetBrandId,
        referralCode: null,
        contracts: {
          some: { status: { in: ['ACTIVO', 'Activo', 'ACEPTADO', 'Aceptado', 'TRAMITADO', 'FIRMADO'] } },
        },
      },
    }),
    prisma.brand.findUnique({
      where: { id: targetBrandId },
      select: { domain: true, codigoMarca: true, name: true },
    }),
  ]);

  const sampleInviteLink = buildPublicReferralLink(
    brand?.domain,
    'TEST',
    brand?.codigoMarca || brand?.name
  );

  return {
    success: true,
    config,
    brandDomain: brand?.domain || null,
    hasPublicInviteDomain: Boolean(sampleInviteLink),
    activeClientsWithoutCodeCount,
    canEdit: ['SUPERADMIN', 'COMPANYADMIN'].includes(access.role),
  };
}

export interface UpdateBrandReferralSettingsInput {
  brandId?: string;
  isEnabled: boolean;
  codePrefix: string;
  referrerRewardEur: number;
  referredRewardEur: number;
  referrerReward30tdEur?: number | null;
  referredReward30tdEur?: number | null;
  allowedTariffs: string[];
  triggerMilestone: ReferralTriggerMilestone;
  minActiveDays: number;
  cooldownMonthsSameCups: number;
  allowSelfReferral: boolean;
  blockSameIban: boolean;
  maxReferralsPerYear?: number | null;
  maxAnnualRewardEur?: number | null;
  creditExpirationMonths?: number | null;
  zeroChannelCommission: boolean;
  legalTermsUrl?: string | null;
}

export async function updateBrandReferralSettingsAction(input: UpdateBrandReferralSettingsInput) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN'].includes(access.role)) {
    return { success: false, error: 'Solo SUPERADMIN y COMPANYADMIN pueden editar la configuración del Plan Amigo.' };
  }

  const targetBrandId = input.brandId || access.activeBrandId;
  if (!targetBrandId || !access.canAccessBrand(targetBrandId)) {
    return { success: false, error: 'Marca no autorizada.' };
  }

  let cleanPrefix = String(input.codePrefix || 'AMIGO-')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!cleanPrefix.endsWith('-')) cleanPrefix = `${cleanPrefix}-`;

  const cleanTariffs = Array.from(
    new Set(
      (input.allowedTariffs || ['2.0TD', '3.0TD'])
        .map((t) => String(t).trim().toUpperCase())
        .filter(Boolean)
    )
  );

  // Tope fiscal anual por Padrino acotado estrictamente a <= 300,00 € (Art. 75.3.f RIRPF)
  const cappedAnnualRewardEur = resolveEffectiveMaxAnnualEur(input.maxAnnualRewardEur);
  const safeMaxReferralsPerYear =
    input.maxReferralsPerYear !== null && input.maxReferralsPerYear !== undefined && Number(input.maxReferralsPerYear) > 0
      ? Math.round(Number(input.maxReferralsPerYear))
      : null;

  const updated = await prisma.brandReferralConfig.upsert({
    where: { brandId: targetBrandId },
    create: {
      brandId: targetBrandId,
      isEnabled: Boolean(input.isEnabled),
      codePrefix: cleanPrefix,
      referrerRewardEur: Math.max(0, Number(input.referrerRewardEur || 0)),
      referredRewardEur: Math.max(0, Number(input.referredRewardEur || 0)),
      referrerReward30tdEur:
        input.referrerReward30tdEur !== null && input.referrerReward30tdEur !== undefined
          ? Math.max(0, Number(input.referrerReward30tdEur))
          : null,
      referredReward30tdEur:
        input.referredReward30tdEur !== null && input.referredReward30tdEur !== undefined
          ? Math.max(0, Number(input.referredReward30tdEur))
          : null,
      allowedTariffs: cleanTariffs.length > 0 ? cleanTariffs : ['2.0TD', '3.0TD'],
      triggerMilestone: input.triggerMilestone || 'ON_DAYS_ACTIVE',
      minActiveDays: Math.max(0, Math.round(Number(input.minActiveDays ?? 15))),
      cooldownMonthsSameCups: Math.max(0, Math.round(Number(input.cooldownMonthsSameCups ?? 12))),
      allowSelfReferral: Boolean(input.allowSelfReferral),
      blockSameIban: Boolean(input.blockSameIban),
      maxReferralsPerYear: safeMaxReferralsPerYear,
      maxAnnualRewardEur: cappedAnnualRewardEur,
      creditExpirationMonths:
        input.creditExpirationMonths !== null &&
        input.creditExpirationMonths !== undefined &&
        Number(input.creditExpirationMonths) > 0
          ? Math.round(Number(input.creditExpirationMonths))
          : null,
      zeroChannelCommission: Boolean(input.zeroChannelCommission),
      legalTermsUrl: input.legalTermsUrl ? String(input.legalTermsUrl).trim() : null,
      updatedByUserId: access.userId,
    },
    update: {
      isEnabled: Boolean(input.isEnabled),
      codePrefix: cleanPrefix,
      referrerRewardEur: Math.max(0, Number(input.referrerRewardEur || 0)),
      referredRewardEur: Math.max(0, Number(input.referredRewardEur || 0)),
      referrerReward30tdEur:
        input.referrerReward30tdEur !== null && input.referrerReward30tdEur !== undefined
          ? Math.max(0, Number(input.referrerReward30tdEur))
          : null,
      referredReward30tdEur:
        input.referredReward30tdEur !== null && input.referredReward30tdEur !== undefined
          ? Math.max(0, Number(input.referredReward30tdEur))
          : null,
      allowedTariffs: cleanTariffs.length > 0 ? cleanTariffs : ['2.0TD', '3.0TD'],
      triggerMilestone: input.triggerMilestone || 'ON_DAYS_ACTIVE',
      minActiveDays: Math.max(0, Math.round(Number(input.minActiveDays ?? 15))),
      cooldownMonthsSameCups: Math.max(0, Math.round(Number(input.cooldownMonthsSameCups ?? 12))),
      allowSelfReferral: Boolean(input.allowSelfReferral),
      blockSameIban: Boolean(input.blockSameIban),
      maxReferralsPerYear: safeMaxReferralsPerYear,
      maxAnnualRewardEur: cappedAnnualRewardEur,
      creditExpirationMonths:
        input.creditExpirationMonths !== null &&
        input.creditExpirationMonths !== undefined &&
        Number(input.creditExpirationMonths) > 0
          ? Math.round(Number(input.creditExpirationMonths))
          : null,
      zeroChannelCommission: Boolean(input.zeroChannelCommission),
      legalTermsUrl: input.legalTermsUrl ? String(input.legalTermsUrl).trim() : null,
      updatedByUserId: access.userId,
    },
  });

  revalidatePath('/ajustes');
  revalidatePath('/plan-amigo');
  revalidatePath('/');
  return { success: true, config: updated };
}

export async function backfillBrandReferralCodesAction(explicitBrandId?: string) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN'].includes(access.role)) {
    return { success: false, error: 'No autorizado.' };
  }

  const targetBrandId = explicitBrandId || access.activeBrandId;
  if (!targetBrandId || !access.canAccessBrand(targetBrandId)) {
    return { success: false, error: 'Marca no autorizada.' };
  }

  const res = await backfillBrandReferralCodes(targetBrandId);
  revalidatePath('/ajustes');
  revalidatePath('/plan-amigo');
  revalidatePath('/clientes');
  return { success: true, generatedCount: res.generatedCount };
}

export async function getPlanAmigoDashboardDataAction(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}) {
  const access = await getBrandAccessContext();
  if (!access) return { success: false, error: 'No autorizado' };

  const brandId = access.activeBrandId;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { referralConfig: true, company: true },
  });

  // ── MODO PORTAL DEL CLIENTE ('CLIENT') ───────────────────────────────────
  if (access.role === 'CLIENT') {
    const config = brand?.referralConfig || (await getOrCreateBrandReferralConfig(brandId));

    const client = await prisma.client.findFirst({
      where: {
        brandId,
        OR: buildClientEmailMatchOr(access.email),
      },
      include: {
        referralsMade: {
          orderBy: { createdAt: 'desc' },
          include: {
            referredClient: {
              select: { businessName: true, firstName: true, lastName: true },
            },
            referredLead: {
              select: { businessName: true },
            },
            referredContract: {
              select: { status: true, activationDate: true },
            },
          },
        },
        referralWalletTxs: {
          where: { brandId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    const hasPriorActivity = Boolean(
      client && (client.referralWalletTxs.length > 0 || client.referralsMade.length > 0)
    );

    if (!config.isEnabled && !hasPriorActivity) {
      return {
        success: true,
        mode: 'CLIENT' as const,
        isEnabled: false,
      };
    }

    if (!client) {
      return {
        success: true,
        mode: 'CLIENT' as const,
        isEnabled: config.isEnabled,
        hasClientRecord: false,
      };
    }

    const personalCode = config.isEnabled
      ? client.referralCode || (await ensureClientReferralCode(client.id))
      : client.referralCode;
    const availableBalanceEur = await getClientAvailableReferralBalance(client.id, brandId);

    const totalSavedToDateEur = client.referralWalletTxs
      .filter((tx) => tx.type === 'INVOICE_REDEMPTION')
      .reduce((acc, tx) => acc + Math.abs(tx.amountEur), 0);

    const reversedSum = client.referralWalletTxs
      .filter((tx) => tx.type === 'INVOICE_REVERSAL')
      .reduce((acc, tx) => acc + Math.abs(tx.amountEur), 0);

    const netSavedEur = Math.max(0, Math.round((totalSavedToDateEur - reversedSum) * 100) / 100);

    const inviteLink =
      config.isEnabled && personalCode
        ? buildPublicReferralLink(brand?.domain, personalCode, brand?.codigoMarca || brand?.name)
        : '';

    const anonymizedInvites = client.referralsMade.map((ref) => {
      const displayTarget = ref.referredClient
        ? maskReferrerDisplayName(ref.referredClient)
        : maskReferrerDisplayName({ businessName: ref.referredLead?.businessName || 'Invitado' });

      let statusLabel = 'Pendiente de firma';
      if (ref.status === 'PENDING_ACTIVATION') {
        statusLabel =
          ref.referredContract?.status === 'ACTIVO'
            ? `Activo — consolidando (${ref.minActiveDaysSnap} días)`
            : 'En activación con distribuidora';
      } else if (ref.status === 'REWARDED') {
        statusLabel = `Completado (+${ref.referrerRewardSnapshot.toFixed(2).replace('.', ',')} €)`;
      } else if (ref.status === 'CANCELLED') {
        statusLabel = 'No consolidado / Cancelado';
      }

      return {
        id: ref.id,
        maskedName: displayTarget,
        status: ref.status,
        statusLabel,
        rewardEur: ref.referrerRewardSnapshot,
        createdAt: ref.createdAt.toISOString(),
        rewardedAt: ref.rewardedAt ? ref.rewardedAt.toISOString() : null,
      };
    });

    return {
      success: true,
      mode: 'CLIENT' as const,
      isEnabled: config.isEnabled,
      hasPriorActivity,
      hasClientRecord: true,
      brandInfo: {
        name: brand?.name || 'Tu Comercializadora',
        accentColor: brand?.accentColor || '#e8622a',
        bgColor: brand?.bgColor || '#0B0F19',
        surfaceColor: brand?.surfaceColor || '#111827',
        legalTermsUrl: config.legalTermsUrl,
        referrerRewardEur: config.referrerRewardEur,
        referredRewardEur: config.referredRewardEur,
        referrerReward30tdEur: config.referrerReward30tdEur,
        referredReward30tdEur: config.referredReward30tdEur,
        minActiveDays: config.minActiveDays,
        maxAnnualRewardEur: resolveEffectiveMaxAnnualEur(config.maxAnnualRewardEur),
      },
      clientPortal: {
        referralCode: personalCode,
        referralCodeActive: client.referralCodeActive,
        inviteLink,
        availableBalanceEur,
        netSavedEur,
        invites: anonymizedInvites,
        walletHistory: client.referralWalletTxs.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amountEur: tx.amountEur,
          balanceAfterEur: tx.balanceAfterEur,
          notes: tx.notes,
          createdAt: tx.createdAt.toISOString(),
        })),
      },
    };
  }

  // ── MODO BACKOFFICE ERP ('SUPERADMIN' | 'COMPANYADMIN' | 'BACKOFFICE') ────
  if (!['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    return { success: false, error: 'No autorizado' };
  }

  const page = Math.max(1, Number(params?.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(params?.pageSize || 25)));
  const statusFilter = params?.status && params.status !== 'ALL' ? (params.status as ReferralStatus) : undefined;
  const searchClean = (params?.search || '').trim();

  const whereClause: any = {
    brandId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(searchClean
      ? {
          OR: [
            { referralCodeUsed: { contains: searchClean, mode: 'insensitive' } },
            { referredCups: { contains: searchClean, mode: 'insensitive' } },
            { referrerClient: { businessName: { contains: searchClean, mode: 'insensitive' } } },
            { referrerClient: { vatNumber: { contains: searchClean, mode: 'insensitive' } } },
            { referredClient: { businessName: { contains: searchClean, mode: 'insensitive' } } },
            { referredClient: { vatNumber: { contains: searchClean, mode: 'insensitive' } } },
            { referredLead: { businessName: { contains: searchClean, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [
    config,
    inProgressCount,
    rewardedContractsCount,
    positiveIssuedAgg,
    netLiabilityAgg,
    totalCount,
    referrals,
  ] = await Promise.all([
    getOrCreateBrandReferralConfig(brandId),
    prisma.referral.count({
      where: { brandId, status: { in: ['PENDING_SIGNATURE', 'PENDING_ACTIVATION'] } },
    }),
    prisma.referral.count({
      where: { brandId, status: 'REWARDED' },
    }),
    prisma.referralWalletTransaction.aggregate({
      where: {
        brandId,
        type: { in: ['CREDIT_REFERRER', 'CREDIT_REFERRED'] },
      },
      _sum: { amountEur: true },
    }),
    prisma.referralWalletTransaction.aggregate({
      where: { brandId },
      _sum: { amountEur: true },
    }),
    prisma.referral.count({ where: whereClause }),
    prisma.referral.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        referrerClient: {
          select: { id: true, businessName: true, firstName: true, lastName: true, vatNumber: true },
        },
        referredClient: {
          select: { id: true, businessName: true, firstName: true, lastName: true, vatNumber: true },
        },
        referredLead: {
          select: { id: true, businessName: true, status: true, tariff: true },
        },
        referredContract: {
          select: {
            id: true,
            contractCode: true,
            status: true,
            activationDate: true,
            signatureDate: true,
          },
        },
      },
    }),
  ]);

  return {
    success: true,
    mode: 'BACKOFFICE' as const,
    canAdminActions: ['SUPERADMIN', 'COMPANYADMIN'].includes(access.role),
    brandName: brand?.name || 'Marca activa',
    config: {
      isEnabled: config.isEnabled,
      codePrefix: config.codePrefix,
      referrerRewardEur: config.referrerRewardEur,
      referredRewardEur: config.referredRewardEur,
      minActiveDays: config.minActiveDays,
      triggerMilestone: config.triggerMilestone,
      maxReferralsPerYear: config.maxReferralsPerYear,
      maxAnnualRewardEur: resolveEffectiveMaxAnnualEur(config.maxAnnualRewardEur),
    },
    kpis: {
      inProgressCount,
      rewardedContractsCount,
      totalIssuedEur: Math.round(Number(positiveIssuedAgg._sum.amountEur || 0) * 100) / 100,
      outstandingLiabilityEur: Math.max(
        0,
        Math.round(Number(netLiabilityAgg._sum.amountEur || 0) * 100) / 100
      ),
    },
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
    rows: referrals.map((r) => ({
      id: r.id,
      code: r.referralCodeUsed,
      status: r.status,
      referredCups: r.referredCups,
      referrerRewardEur: r.referrerRewardSnapshot,
      referredRewardEur: r.referredRewardSnapshot,
      triggerMilestone: r.triggerMilestoneSnap,
      minActiveDays: r.minActiveDaysSnap,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt.toISOString(),
      rewardedAt: r.rewardedAt ? r.rewardedAt.toISOString() : null,
      referrer: {
        id: r.referrerClient.id,
        name:
          r.referrerClient.businessName ||
          `${r.referrerClient.firstName || ''} ${r.referrerClient.lastName || ''}`.trim(),
        vatNumber: r.referrerClient.vatNumber,
      },
      referred: {
        clientId: r.referredClient?.id || null,
        name:
          r.referredClient?.businessName ||
          r.referredLead?.businessName ||
          'Pendiente',
        vatNumber: r.referredClient?.vatNumber || '-',
        leadId: r.referredLead?.id || null,
        tariff: r.referredLead?.tariff || '-',
        contractId: r.referredContract?.id || null,
        contractCode: r.referredContract?.contractCode || null,
        contractStatus: r.referredContract?.status || r.referredLead?.status || 'SIN CONTRATO',
        activationDate: r.referredContract?.activationDate
          ? r.referredContract.activationDate.toISOString()
          : null,
      },
    })),
  };
}

export async function runReferralConsolidationAction() {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    return { success: false, error: 'No autorizado' };
  }

  const summary = await reconcileReferralsLifecycle({ brandId: access.activeBrandId });
  revalidatePath('/plan-amigo');
  revalidatePath('/clientes');
  return { success: true, summary };
}

export async function adminUpdateReferralStatusAction(input: {
  referralId: string;
  action: 'CANCEL' | 'FORCE_REWARD';
  reason?: string;
}) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN'].includes(access.role)) {
    return { success: false, error: 'Solo SUPERADMIN o COMPANYADMIN pueden ejecutar esta acción.' };
  }

  const ref = await prisma.referral.findUnique({
    where: { id: input.referralId },
    include: {
      brand: { include: { referralConfig: true } },
      referredContract: true,
    },
  });
  if (!ref || !access.canAccessBrand(ref.brandId)) {
    return { success: false, error: 'Recomendación no encontrada o fuera de tu marca.' };
  }

  if (input.action === 'CANCEL') {
    if (ref.status === 'REWARDED') {
      return {
        success: false,
        error: 'Esta invitación ya fue abonada. Usa un Ajuste Manual en la ficha del cliente si deseas detraer saldo.',
      };
    }
    await prisma.referral.update({
      where: { id: ref.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: (input.reason || 'CANCELACION_MANUAL_ADMIN').trim().slice(0, 120),
      },
    });
    revalidatePath('/plan-amigo');
    if (ref.referrerClientId) revalidatePath(`/clientes/${ref.referrerClientId}`);
    if (ref.referredClientId) revalidatePath(`/clientes/${ref.referredClientId}`);
    return { success: true };
  }

  if (ref.status === 'REWARDED') {
    return { success: false, error: 'Esta invitación ya tiene sus premios abonados.' };
  }

  const referredClientId = ref.referredClientId || ref.referredContract?.clientId;
  if (!referredClientId) {
    return { success: false, error: 'El invitado aún no tiene ficha de Cliente vinculada.' };
  }

  const now = new Date();
  const expMonths = ref.brand?.referralConfig?.creditExpirationMonths ?? 24;
  let expiresAt: Date | null = null;
  if (expMonths && expMonths > 0) {
    expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + expMonths);
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.referral.findUnique({ where: { id: ref.id } });
    if (!fresh || fresh.status === 'REWARDED') return;

    await tx.$queryRawUnsafe(`SELECT "id" FROM "Client" WHERE "id" = $1 FOR UPDATE`, ref.referrerClientId);
    const effectiveMaxAnnualEur = resolveEffectiveMaxAnnualEur(
      ref.brand?.referralConfig?.maxAnnualRewardEur ?? MAX_LEGAL_ANNUAL_REFERRAL_EUR
    );
    const creditedThisYear = await getReferrerCreditedThisYearEur(
      tx,
      ref.brandId,
      ref.referrerClientId,
      getMadridCalendarYearStartUtc(now)
    );
    const remainingCap = round2(Math.max(0, effectiveMaxAnnualEur - creditedThisYear));
    const effectiveReferrerReward = round2(Math.min(Math.max(0, fresh.referrerRewardSnapshot), remainingCap));

    if (effectiveReferrerReward > 0) {
      const capNote =
        effectiveReferrerReward < fresh.referrerRewardSnapshot
          ? ` (acotado al tope anual de ${effectiveMaxAnnualEur.toFixed(2)} €)`
          : '';
      await recordWalletTransactionAtomic(tx, {
        brandId: ref.brandId,
        clientId: ref.referrerClientId,
        referralId: ref.id,
        type: 'CREDIT_REFERRER',
        amountEur: effectiveReferrerReward,
        expiresAt,
        createdByUserId: access.userId,
        notes: `Liberación anticipada autorizada (${input.reason || 'Admin'}) — CUPS ${ref.referredCups.slice(0, 20)}${capNote}`,
      });
    }

    if (fresh.referredRewardSnapshot > 0) {
      await recordWalletTransactionAtomic(tx, {
        brandId: ref.brandId,
        clientId: referredClientId,
        referralId: ref.id,
        type: 'CREDIT_REFERRED',
        amountEur: fresh.referredRewardSnapshot,
        expiresAt,
        createdByUserId: access.userId,
        notes: `Liberación bienvenida autorizada (${input.reason || 'Admin'}) — código ${ref.referralCodeUsed}`,
      });
    }

    await tx.referral.update({
      where: { id: ref.id },
      data: {
        referredClientId,
        status: 'REWARDED',
        qualifiedAt: now,
        rewardedAt: now,
        cancelledAt: null,
        cancelReason: null,
      },
    });
  });

  revalidatePath('/plan-amigo');
  revalidatePath(`/clientes/${ref.referrerClientId}`);
  revalidatePath(`/clientes/${referredClientId}`);
  return { success: true };
}

export async function getClientReferralDetailAction(clientId: string) {
  const access = await getBrandAccessContext();
  if (!access) return { success: false, error: 'No autorizado' };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      brand: { include: { referralConfig: true, company: true } },
      referralsMade: {
        orderBy: { createdAt: 'desc' },
        include: {
          referredClient: { select: { id: true, businessName: true, vatNumber: true } },
          referredLead: { select: { id: true, businessName: true, status: true } },
          referredContract: { select: { id: true, contractCode: true, status: true, activationDate: true } },
        },
      },
      referralsReceived: {
        orderBy: { createdAt: 'desc' },
        include: {
          referrerClient: { select: { id: true, businessName: true, vatNumber: true, referralCode: true } },
        },
      },
      referralWalletTxs: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          internalInvoice: { select: { id: true, invoiceNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      },
    },
  });

  if (!client || !access.canAccessBrand(client.brandId)) {
    return { success: false, error: 'Cliente no encontrado o no autorizado' };
  }

  const availableBalanceEur = await getClientAvailableReferralBalance(client.id, client.brandId);
  const inviteLink = client.referralCode
    ? buildPublicReferralLink(
        client.brand?.domain,
        client.referralCode,
        client.brand?.codigoMarca || client.brand?.name
      )
    : null;

  return {
    success: true,
    canManage: ['SUPERADMIN', 'COMPANYADMIN'].includes(access.role),
    isBackoffice: ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role),
    programEnabled: Boolean(client.brand?.referralConfig?.isEnabled),
    referralCode: client.referralCode,
    referralCodeActive: client.referralCodeActive,
    inviteLink,
    availableBalanceEur,
    invitedBy: client.referralsReceived[0]
      ? {
          referralId: client.referralsReceived[0].id,
          codeUsed: client.referralsReceived[0].referralCodeUsed,
          status: client.referralsReceived[0].status,
          referredRewardEur: client.referralsReceived[0].referredRewardSnapshot,
          referrerId: client.referralsReceived[0].referrerClient.id,
          referrerName:
            access.role === 'CLIENT'
              ? maskReferrerDisplayName(client.referralsReceived[0].referrerClient)
              : client.referralsReceived[0].referrerClient.businessName,
        }
      : null,
    referralsMade: client.referralsMade.map((r) => ({
      id: r.id,
      cups: r.referredCups,
      status: r.status,
      rewardEur: r.referrerRewardSnapshot,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt.toISOString(),
      rewardedAt: r.rewardedAt ? r.rewardedAt.toISOString() : null,
      referredClientId: r.referredClient?.id || null,
      referredName:
        access.role === 'CLIENT'
          ? maskReferrerDisplayName(r.referredClient || { businessName: r.referredLead?.businessName })
          : r.referredClient?.businessName || r.referredLead?.businessName || 'Pendiente',
      contractId: r.referredContract?.id || null,
      contractCode: r.referredContract?.contractCode || null,
      contractStatus: r.referredContract?.status || r.referredLead?.status || 'PENDIENTE',
    })),
    ledger: client.referralWalletTxs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountEur: tx.amountEur,
      balanceAfterEur: tx.balanceAfterEur,
      expiresAt: tx.expiresAt ? tx.expiresAt.toISOString() : null,
      notes: tx.notes,
      invoiceNumber: tx.internalInvoice?.invoiceNumber || tx.invoice?.invoiceNumber || null,
      internalInvoiceId: tx.internalInvoice?.id || null,
      invoiceId: tx.invoice?.id || null,
      createdByUserId: tx.createdByUserId,
      createdAt: tx.createdAt.toISOString(),
    })),
  };
}

export async function toggleClientReferralCodeAction(clientId: string, active: boolean) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    return { success: false, error: 'No autorizado' };
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || !access.canAccessBrand(client.brandId)) {
    return { success: false, error: 'Cliente no encontrado' };
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { referralCodeActive: Boolean(active) },
  });

  revalidatePath(`/clientes/${clientId}`);
  return { success: true };
}

export async function generateAndSendClientCodeAction(clientId: string, sendEmail: boolean = false) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    return { success: false, error: 'No autorizado' };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { brand: { include: { company: true, referralConfig: true } } },
  });
  if (!client || !access.canAccessBrand(client.brandId)) {
    return { success: false, error: 'Cliente no encontrado' };
  }

  const code = await ensureClientReferralCode(client.id);
  if (!code) {
    return { success: false, error: 'No se pudo generar el código para este cliente.' };
  }

  let emailSent = false;
  if (sendEmail && client.contactEmail) {
    const cfg = client.brand?.referralConfig || (await getOrCreateBrandReferralConfig(client.brandId));
    emailSent = await sendClientPersonalReferralCodeEmail({
      brand: {
        brandName: client.brand?.name || 'AED Energía',
        companyName: client.brand?.company?.name || null,
        logoUrl: client.brand?.logoUrl,
        accentColor: client.brand?.accentColor || '#e8622a',
        domain: client.brand?.domain,
        supportEmail: client.brand?.supportEmail || client.brand?.email,
        phone: client.brand?.phone || null,
      },
      clientEmail: client.contactEmail,
      clientName: client.firstName || client.businessName,
      referralCode: code,
      referrerRewardEur: cfg.referrerRewardEur,
      referredRewardEur: cfg.referredRewardEur,
    });
  }

  revalidatePath(`/clientes/${clientId}`);
  return { success: true, code, emailSent };
}

export async function createManualWalletAdjustmentAction(input: {
  clientId: string;
  amountEur: number;
  notes: string;
}) {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN'].includes(access.role)) {
    return {
      success: false,
      error: 'Solo SUPERADMIN y COMPANYADMIN pueden registrar ajustes manuales en el monedero.',
    };
  }

  const delta = Math.round(Number(input.amountEur || 0) * 100) / 100;
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) {
    return { success: false, error: 'Introduce un importe distinto de 0,00 €.' };
  }

  const cleanNotes = String(input.notes || '').trim();
  if (cleanNotes.length < 4) {
    return { success: false, error: 'Es obligatorio indicar el motivo del ajuste para auditoría.' };
  }

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    include: { brand: { include: { referralConfig: true } } },
  });
  if (!client || !access.canAccessBrand(client.brandId)) {
    return { success: false, error: 'Cliente no encontrado.' };
  }

  let expiresAt: Date | null = null;
  const expMonths = client.brand?.referralConfig?.creditExpirationMonths ?? 24;
  if (delta > 0 && expMonths && expMonths > 0) {
    expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + expMonths);
  }

  const txRow = await prisma.$transaction(async (tx) => {
    return recordWalletTransactionAtomic(tx, {
      brandId: client.brandId,
      clientId: client.id,
      type: 'MANUAL_ADJUSTMENT',
      amountEur: delta,
      expiresAt,
      createdByUserId: access.userId,
      notes: `[Ajuste manual ${access.email}] ${cleanNotes}`,
    });
  });

  if (!txRow) {
    return { success: false, error: 'El cliente no dispone de saldo suficiente para detraer ese importe.' };
  }

  revalidatePath(`/clientes/${client.id}`);
  revalidatePath('/plan-amigo');
  return { success: true, balanceAfterEur: txRow.balanceAfterEur };
}
