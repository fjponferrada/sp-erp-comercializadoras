import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { reconcileReferralsLifecycle } from '@/lib/services/ReferralEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET?.trim();
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');

    const hasValidCronSecret = Boolean(
      expectedSecret &&
        (cronSecret === expectedSecret || authHeader === `Bearer ${expectedSecret}`)
    );

    if (!hasValidCronSecret) {
      const session = await auth();
      const email = session?.user?.email?.trim();
      const adminUser = email
        ? await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
            select: { role: true },
          })
        : null;
      if (!adminUser || !['SUPERADMIN', 'COMPANYADMIN'].includes(adminUser.role)) {
        return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
      }
    }

    const summary = await reconcileReferralsLifecycle();

    return NextResponse.json({
      success: true,
      message: `Consolidación Plan Amigo completada: ${summary.rewardedCount} bonificados, ${summary.movedToPendingActivation} en activación, ${summary.cancelledCount} cancelados, ${summary.codesGenerated} códigos nuevos.`,
      summary,
    });
  } catch (error: any) {
    console.error('❌ Error en CRON process-referrals:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
