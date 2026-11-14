import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';

    const municipalities = await prisma.municipality.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: {
        province: true,
      },
      take: 50,
      orderBy: {
        name: 'asc',
      },
    });

    const poblaciones = municipalities.map((mun) => ({
      label: `${mun.name.toUpperCase()} -- ${mun.province.name.toUpperCase()} -- ESPAÑA`,
      // Incluimos la provincia en el valor para desambiguar municipios homónimos entre provincias
      value: `${mun.name} -- ${mun.province.name}`,
    }));

    return NextResponse.json(poblaciones);
  } catch (error) {
    console.error('Error fetching poblaciones:', error);
    return NextResponse.json({ error: 'Failed to fetch poblaciones' }, { status: 500 });
  }
}
