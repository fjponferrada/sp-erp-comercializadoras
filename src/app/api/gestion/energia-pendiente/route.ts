import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

function getMaxClosedMonthMadrid(): string {
  const madridToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const [curY, curM] = madridToday.split('-').map(Number);
  const lastClosed = new Date(Date.UTC(curY, curM - 2, 1));
  return lastClosed.toISOString().slice(0, 7);
}

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role as string | undefined;
    if (!session || !hasAdminOrBackofficeRole(role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let activeCompanyId = await resolveActiveCompanyId(session);
    if (!activeCompanyId && role === 'SUPERADMIN') {
      const firstComp = await prisma.company.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
      activeCompanyId = firstComp?.id || null;
    }

    if (!activeCompanyId) {
      return NextResponse.json({ error: 'No se pudo determinar la comercializadora activa' }, { status: 400 });
    }

    const maxClosedMonth = getMaxClosedMonthMadrid();

    const [company, results] = await Promise.all([
      prisma.company.findUnique({
        where: { id: activeCompanyId },
        select: { id: true, name: true, cif: true },
      }),
      prisma.pendingEnergySummary.findMany({
        where: {
          companyId: activeCompanyId,
          month: { lte: maxClosedMonth },
        },
        orderBy: { month: 'desc' },
        take: 12,
      }),
    ]);

    const enrichedResults = results.map((row) => {
      const detailsObj = (row.details && typeof row.details === 'object' ? row.details : {}) as Record<string, any>;
      const grossBcConsMwh = (row.estimatedBcMwh || 0) + (row.surplusMwh || 0);

      let lossRatio = 1.15;
      if (row.rawCchMwh > 0 && grossBcConsMwh > 0) {
        lossRatio = grossBcConsMwh / row.rawCchMwh;
      } else if (typeof detailsObj.lossRatio === 'number' && detailsObj.lossRatio > 0) {
        lossRatio = detailsObj.lossRatio;
      }

      const marketPrice = row.marketPrice > 0 ? row.marketPrice : 75;

      return {
        ...row,
        lossRatio,
        marketPrice,
        details: detailsObj,
      };
    });

    return NextResponse.json(
      {
        success: true,
        company,
        maxClosedMonth,
        data: enrichedResults,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error recuperando energía pendiente:', error);
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
  }
}
