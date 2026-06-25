import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const component = searchParams.get('component');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!component || !startDate || !endDate) {
      return NextResponse.json({ error: 'Faltan parámetros de búsqueda' }, { status: 400 });
    }

    const prices = await prisma.systemComponentPrice.findMany({
      where: {
        component,
        date: {
          gte: new Date(`${startDate}T00:00:00Z`),
          lte: new Date(`${endDate}T23:59:59Z`)
        }
      },
      orderBy: { date: 'asc' }
    });

    return NextResponse.json(prices);
  } catch (error: any) {
    console.error('Error GET /api/precios-componentes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
