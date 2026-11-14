import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isComprasAuthorized } from '@/lib/reganecuServer';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!isComprasAuthorized(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const component = searchParams.get('component');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!component || !startDate || !endDate) {
      return NextResponse.json({ error: 'Faltan parámetros de búsqueda' }, { status: 400 });
    }

    const fromDate = new Date(`${startDate}T00:00:00.000Z`);
    const toDate = new Date(`${endDate}T23:59:59.999Z`);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
    }

    const prices = await prisma.systemComponentPrice.findMany({
      where: {
        component,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(prices);
  } catch (error: any) {
    console.error('Error GET /api/precios-componentes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
