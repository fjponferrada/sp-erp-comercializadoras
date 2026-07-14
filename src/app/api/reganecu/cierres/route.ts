import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return NextResponse.json({ error: 'Falta mes' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 1));

    const records = await prisma.reganecuData.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        }
      },
      select: {
        cierre: true
      },
      distinct: ['cierre']
    });

    const CIERRE_ORDER = ['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'A4', 'C4', 'A5', 'C5', 'A6', 'C6', 'A7', 'C7', 'A8', 'C8'];
    const cierres = records
      .map(r => r.cierre)
      .sort((a, b) => {
        const indexA = CIERRE_ORDER.indexOf(a);
        const indexB = CIERRE_ORDER.indexOf(b);
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
