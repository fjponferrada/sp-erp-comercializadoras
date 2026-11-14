import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { generateTomorrowForecast } from '@/lib/services/ForecastService';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes para generar predicciones de compras' },
        { status: 403 }
      );
    }

    let targetDate: string | undefined = undefined;
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (typeof body?.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) {
          targetDate = body.targetDate;
        }
      }
    } catch {
      // Cuerpo vacío o no JSON: usar fecha por defecto (mañana en Europe/Madrid)
    }

    const companyId = await resolveActiveCompanyId(session);
    const result = await generateTomorrowForecast(companyId, {
      targetDate,
      userId: (session.user as any).id || null,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Forecast API error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
