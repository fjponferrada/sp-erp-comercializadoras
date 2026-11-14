import { NextResponse } from 'next/server';
import { AggregationService } from '@/lib/services/AggregationService';
import { WeatherSyncService } from '@/lib/services/WeatherSyncService';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

export const maxDuration = 300;

const LOCAL_FALLBACK_CRON_TOKEN = 'SpEnergia2026_UltraCron';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const daysParam = searchParams.get('days');
    const rawDays = daysParam ? parseInt(daysParam, 10) : 60;

    const isRangeMode = Boolean(startDateParam && endDateParam);
    let rangeDates: string[] = [];

    if (isRangeMode) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDateParam!) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDateParam!)
      ) {
        return NextResponse.json(
          { error: 'startDate y endDate deben tener formato YYYY-MM-DD' },
          { status: 400 }
        );
      }
      const startDt = new Date(`${startDateParam}T00:00:00.000Z`);
      const endDt = new Date(`${endDateParam}T00:00:00.000Z`);
      const spanDays = Math.round((endDt.getTime() - startDt.getTime()) / 86_400_000) + 1;
      if (isNaN(spanDays) || spanDays <= 0 || spanDays > 65) {
        return NextResponse.json(
          { error: 'El rango [startDate..endDate] debe comprender entre 1 y 65 días' },
          { status: 400 }
        );
      }
      for (let i = 0; i < spanDays; i++) {
        const cur = new Date(startDt.getTime() + i * 86_400_000);
        rangeDates.push(cur.toISOString().slice(0, 10));
      }
    } else if (isNaN(rawDays) || rawDays <= 0 || rawDays > 730) {
      return NextResponse.json({ error: 'Parámetro days inválido (debe estar entre 1 y 730)' }, { status: 400 });
    }

    const cronSecret = searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const cronHeader = req.headers.get('x-vercel-cron');
    const expectedSecret = process.env.CRON_SECRET;
    const isCronAuthorized =
      (Boolean(expectedSecret) &&
        (cronSecret === expectedSecret || authHeader === `Bearer ${expectedSecret}`)) ||
      (cronHeader === '1' && Boolean(process.env.VERCEL)) ||
      (!expectedSecret &&
        (cronSecret === LOCAL_FALLBACK_CRON_TOKEN ||
          authHeader === `Bearer ${LOCAL_FALLBACK_CRON_TOKEN}`));

    let targetCompanyId: string | undefined = undefined;

    if (isCronAuthorized) {
      // Ejecución nocturna CRON: regenera todas las comercializadoras (o una concreta si viene ?companyId=...)
      targetCompanyId = searchParams.get('companyId') || undefined;
    } else {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!hasAdminOrBackofficeRole((session.user as any).role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const companyId = await resolveActiveCompanyId(session);
      if (!companyId) {
        return NextResponse.json({ error: 'No active company selected' }, { status: 400 });
      }
      targetCompanyId = companyId;
    }

    let rows = 0;
    let processedDaysCount = rawDays;

    if (isRangeMode) {
      processedDaysCount = rangeDates.length;
      console.log(
        `API Sincronización Histórico (ventana ${startDateParam} → ${endDateParam}, ${processedDaysCount}d), CompanyId: ${targetCompanyId || 'ALL'}`
      );
      rows = await AggregationService.regenerateForDates(rangeDates, targetCompanyId);
    } else {
      console.log(
        `API Sincronización Histórico llamada. Días: ${rawDays}, CompanyId: ${targetCompanyId || 'ALL'}`
      );
      rows = await AggregationService.regenerateAggregates(rawDays, targetCompanyId);
    }

    let weatherRepair = null;
    if ((!isRangeMode && rawDays >= 365) || searchParams.get('repairWeather') === '1') {
      weatherRepair = await WeatherSyncService.repairHistoricalAggregates();
    }

    if (searchParams.get('skipPending') !== '1') {
      try {
        await runCalculatePendingEnergy(undefined, targetCompanyId);
      } catch (pendingErr) {
        console.error('Aviso: error recalculando energía pendiente en cron aggregate-history:', pendingErr);
      }
    }

    return NextResponse.json({
      success: true,
      rowsInserted: rows,
      daysProcessed: processedDaysCount,
      ...(isRangeMode ? { startDate: startDateParam, endDate: endDateParam } : {}),
      ...(weatherRepair ? { weatherRepair } : {}),
    });
  } catch (error: any) {
    console.error('Error en aggregate-history:', error);
    return NextResponse.json({ error: error.message || 'Error interno al regenerar curvas' }, { status: 500 });
  }
}
