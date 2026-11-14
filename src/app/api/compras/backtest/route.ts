import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { runHistoricalBacktest } from '@/lib/services/ForecastService';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes para ejecutar backtesting de compras' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const targetDate = typeof body?.targetDate === 'string' ? body.targetDate.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json(
        { error: 'Debe indicar una fecha válida YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const companyId = await resolveActiveCompanyId(session);
    const result = await runHistoricalBacktest(targetDate, companyId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Backtest API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al ejecutar auditoría de precisión' },
      { status: 400 }
    );
  }
}
