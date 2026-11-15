import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchIneMunicipalities } from '@/lib/municipalityResolver';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any).role as string | undefined;
    if (userRole && !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';

    const poblaciones = await searchIneMunicipalities(query, 50);
    return NextResponse.json(poblaciones);
  } catch (error) {
    console.error('Error fetching poblaciones:', error);
    return NextResponse.json({ error: 'Failed to fetch poblaciones' }, { status: 500 });
  }
}
