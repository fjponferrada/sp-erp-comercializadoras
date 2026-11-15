import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';
import { validateReferralEligibility } from '@/lib/services/ReferralEngine';

export const dynamic = 'force-dynamic';

// Rate-limiting ligero por IP en memoria para impedir enumeración masiva de códigos
const ipHits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 35;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits.entries()) {
      if (v.resetAt <= now) ipHits.delete(k);
    }
  }
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_HITS_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get('x-client-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    if (!checkIpRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          errorCode: 'RATE_LIMITED',
          message: 'Demasiadas comprobaciones seguidas. Espera unos segundos e inténtalo de nuevo.',
        },
        { status: 429 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    const isApiKey = Boolean(token && process.env.AED_API_KEY && token === process.env.AED_API_KEY);

    let targetBrandId: string | null = null;

    if (isApiKey) {
      targetBrandId = req.headers.get('x-brand-id')?.trim() || null;
      if (!targetBrandId) {
        return NextResponse.json(
          { success: false, valid: false, error: 'X-Brand-Id header is required.' },
          { status: 400 }
        );
      }
    } else {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ success: false, valid: false, error: 'Unauthorized' }, { status: 401 });
      }
      const user = await prisma.user.findFirst({
        where: { email: { equals: session.user.email.trim(), mode: 'insensitive' } },
      });
      if (!user || user.isActive === false) {
        return NextResponse.json({ success: false, valid: false, error: 'Forbidden' }, { status: 403 });
      }
      targetBrandId = (await getActiveBrand(user)) || user.brandId;
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || '';
    const tariff = searchParams.get('tariff') || undefined;
    const cups = searchParams.get('cups') || undefined;
    const vatNumber = searchParams.get('vatNumber') || undefined;
    const iban = searchParams.get('iban') || undefined;

    const check = await validateReferralEligibility({
      brandId: targetBrandId,
      code,
      tariff,
      cups,
      vatNumber,
      iban,
    });

    if (!check.valid || !check.referrerClient) {
      return NextResponse.json({
        success: true,
        valid: false,
        errorCode: check.errorCode || 'CODE_NOT_FOUND',
        message: check.message || 'Código no válido.',
      });
    }

    // Respuesta estricta RGPD: únicamente nombre de pila + inicial enmascarada
    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        code: check.normalizedCode,
        referrerDisplayName: check.referrerClient.displayNameMasked,
        referredRewardEur: check.referredRewardEur ?? 0,
        referrerRewardEur: check.referrerRewardEur ?? 0,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/referrals/validate] Error:', error);
    return NextResponse.json(
      { success: false, valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
