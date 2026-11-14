import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SETTLEMENT_ORDER } from '@/lib/reganecuShared';
import { isComprasAuthorized, resolveActiveCompanyId } from '@/lib/reganecuServer';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!isComprasAuthorized(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = await resolveActiveCompanyId(session!.user);
    if (!companyId) {
      return NextResponse.json({ cierres: [] });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');

    if (!dateStr || !/^\d{4}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Falta mes válido' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10), 1));

    const records = await prisma.reganecuData.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        cierre: true,
      },
      distinct: ['cierre'],
    });

    const orderList = SETTLEMENT_ORDER as readonly string[];
    const cierres = records
      .map(r => r.cierre)
      .sort((a, b) => {
        const indexA = orderList.indexOf(a);
        const indexB = orderList.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      });

    return NextResponse.json({ cierres });
  } catch (error: any) {
    console.error('Error fetching Reganecu cierres:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
