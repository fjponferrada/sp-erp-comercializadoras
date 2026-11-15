import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';
import { MAX_LEGAL_ANNUAL_REFERRAL_EUR, resolveEffectiveMaxAnnualEur } from '@/lib/services/ReferralEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    const isApiKey = Boolean(token && process.env.AED_API_KEY && token === process.env.AED_API_KEY);

    let targetBrandId: string | null = null;

    if (isApiKey) {
      targetBrandId = req.headers.get('x-brand-id')?.trim() || null;
      if (!targetBrandId) {
        return NextResponse.json(
          { success: false, error: 'X-Brand-Id header is required.' },
          { status: 400 }
        );
      }
    } else {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      const user = await prisma.user.findFirst({
        where: { email: { equals: session.user.email.trim(), mode: 'insensitive' } },
      });
      if (!user || user.isActive === false) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      targetBrandId = (await getActiveBrand(user)) || user.brandId;
    }

    const cfg = await prisma.brandReferralConfig.findUnique({
      where: { brandId: targetBrandId },
    });

    if (!cfg || !cfg.isEnabled) {
      return NextResponse.json({
        success: true,
        data: {
          isEnabled: false,
          codePrefix: cfg?.codePrefix || 'AMIGO-',
          referrerRewardEur: cfg?.referrerRewardEur ?? 25,
          referredRewardEur: cfg?.referredRewardEur ?? 25,
          referrerReward30tdEur: cfg?.referrerReward30tdEur ?? null,
          referredReward30tdEur: cfg?.referredReward30tdEur ?? null,
          allowedTariffs: cfg?.allowedTariffs ?? ['2.0TD', '3.0TD'],
          minActiveDays: cfg?.minActiveDays ?? 15,
          maxReferralsPerYear: cfg?.maxReferralsPerYear ?? 12,
          maxAnnualRewardEur: resolveEffectiveMaxAnnualEur(cfg?.maxAnnualRewardEur ?? MAX_LEGAL_ANNUAL_REFERRAL_EUR),
          legalTermsUrl: cfg?.legalTermsUrl ?? null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isEnabled: cfg.isEnabled,
        codePrefix: cfg.codePrefix,
        referrerRewardEur: cfg.referrerRewardEur,
        referredRewardEur: cfg.referredRewardEur,
        referrerReward30tdEur: cfg.referrerReward30tdEur,
        referredReward30tdEur: cfg.referredReward30tdEur,
        allowedTariffs: cfg.allowedTariffs,
        triggerMilestone: cfg.triggerMilestone,
        minActiveDays: cfg.minActiveDays,
        cooldownMonthsSameCups: cfg.cooldownMonthsSameCups,
        maxReferralsPerYear: cfg.maxReferralsPerYear,
        maxAnnualRewardEur: resolveEffectiveMaxAnnualEur(cfg.maxAnnualRewardEur),
        creditExpirationMonths: cfg.creditExpirationMonths,
        legalTermsUrl: cfg.legalTermsUrl,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/referrals/config] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
