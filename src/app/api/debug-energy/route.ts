import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const auditResults: Record<string, any> = {};
  const daysToCheck = ['2026-06-01', '2026-06-15', '2026-07-01', '2026-07-15'];

  for (const dayKey of daysToCheck) {
    const dayDate = new Date(`${dayKey}T12:00:00Z`);

    const activeContracts = await prisma.contract.count({
      where: {
        activationDate: { lte: dayDate },
        OR: [{ terminationDate: null }, { terminationDate: { gte: dayDate } }],
      },
    });

    const aggCurves = await prisma.aggregatedLoadCurve.findMany({
      where: {
        date: {
          gte: new Date(`${dayKey}T00:00:00Z`),
          lte: new Date(`${dayKey}T23:59:59Z`),
        },
      },
    });

    let curvesCount = 0;
    for (const curve of aggCurves) {
      curvesCount += curve.clientCount;
    }

    auditResults[dayKey] = {
      activeContractsOnDay: activeContracts,
      curvesFoundOnDay: curvesCount,
      missingCurves: activeContracts - curvesCount,
    };
  }

  return NextResponse.json(auditResults);
}
