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

    const cierres = records.map(r => r.cierre).sort();

    return NextResponse.json({ cierres });
  } catch (error: any) {
    console.error('Error fetching Reganecu cierres:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
