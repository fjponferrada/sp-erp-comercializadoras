import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeProvinceName, PROVINCE_NAMES } from '@/lib/services/ProvinceService';
import { DecisionTreeRegression } from 'ml-cart';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { AggregationService } from '@/lib/services/AggregationService';
import { WeatherSyncService } from '@/lib/services/WeatherSyncService';

export const maxDuration = 300;

const LOCAL_FALLBACK_CRON_TOKEN = 'SpEnergia2026_UltraCron';

const SEGMENTS = [
  'HOGAR 0-5kW',
  'HOGAR 5-10kW',
  'HOGAR 10-15kW',
  'PYME <50 MWh',
  'PYME >50 MWh',
  'VE <15 MWh',
  'VE >15 MWh',
  'VIP',
];

function subtractUtcDays(d: Date, days: number): Date {
  const iso = d.toISOString().slice(0, 10);
  const utc = new Date(`${iso}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() - days);
  return utc;
}

export async function GET(req: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const cronHeader = req.headers.get('x-vercel-cron');
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');

    const isCronAuthorized =
      (Boolean(expectedSecret) &&
        (cronSecret === expectedSecret || authHeader === `Bearer ${expectedSecret}`)) ||
      (cronHeader === '1' && Boolean(process.env.VERCEL)) ||
      (!expectedSecret &&
        (cronSecret === LOCAL_FALLBACK_CRON_TOKEN ||
          authHeader === `Bearer ${LOCAL_FALLBACK_CRON_TOKEN}`));

    let sessionCompanyId: string | undefined = undefined;

    if (!isCronAuthorized) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json(
          { error: 'No autorizado: requiere sesión activa o credencial CRON válida' },
          { status: 401 }
        );
      }
      if (!hasAdminOrBackofficeRole((session.user as any).role)) {
        return NextResponse.json(
          { error: 'Permisos insuficientes para entrenar el motor de predicción' },
          { status: 403 }
        );
      }
      const resolved = await resolveActiveCompanyId(session);
      if (resolved) sessionCompanyId = resolved;
    } else {
      sessionCompanyId = searchParams.get('companyId') || undefined;
    }

    console.log(
      `Synchronizing history before training (companyId=${sessionCompanyId || 'ALL'})...`
    );
    await AggregationService.regenerateAggregates(30, sessionCompanyId);

    // Si WeatherHistory estaba vacía o existen provincias históricas sin normalizar, reparar automáticamente
    const weatherCount = await prisma.weatherHistory.count();
    if (weatherCount === 0) {
      console.log('WeatherHistory vacía detectada: ejecutando saneado histórico y descarga Open-Meteo...');
      await WeatherSyncService.repairHistoricalAggregates();
    }

    console.log('Starting background model training...');

    // Priorizar histórico de la comercializadora activa si posee masa crítica (>= 500 curvas);
    // de lo contrario emplear el pool histórico global de curvas físicas españolas.
    let historyWhere: Record<string, any> = {};
    if (sessionCompanyId) {
      const companyMaxAgg = await prisma.aggregatedLoadCurve.aggregate({
        where: { companyId: sessionCompanyId },
        _max: { date: true },
        _count: { _all: true },
      });
      if (companyMaxAgg._count._all >= 500 && companyMaxAgg._max.date) {
        historyWhere = {
          companyId: sessionCompanyId,
          date: { gte: subtractUtcDays(companyMaxAgg._max.date, 365) },
        };
      }
    }

    if (!historyWhere.date) {
      const maxAgg = await prisma.aggregatedLoadCurve.aggregate({ _max: { date: true } });
      const dbMaxDate = maxAgg._max.date || new Date();
      historyWhere = {
        date: { gte: subtractUtcDays(dbMaxDate, 365) },
      };
    }

    const history = await prisma.aggregatedLoadCurve.findMany({
      where: historyWhere,
    });

    // Compresión determinista ponderada por número real de clientes (clientCount)
    // Key: "segmentId|provinceId|dow|month|h|tempBin|isWknd"
    const groupedData = new Map<
      string,
      { sumCons: number; sumClients: number; weightedTempSum: number }
    >();

    const seenProvinces = new Set<number>();
    let realWeatherCurves = 0;
    let totalEligibleCurves = 0;

    for (const record of history) {
      // VIP y VE se estiman determinísticamente por CUPS mediante SDA
      if (['VIP', 'VE <15 MWh', 'VE >15 MWh'].includes(record.segment)) continue;
      if (record.clientCount <= 0) continue;

      const segmentId = SEGMENTS.indexOf(record.segment);
      const canonicalProv = normalizeProvinceName(record.province);
      const provinceId = PROVINCE_NAMES.indexOf(canonicalProv);
      if (segmentId < 0 || provinceId < 0) continue;

      seenProvinces.add(provinceId);
      totalEligibleCurves++;
      if (
        record.temperature &&
        record.temperature.length > 0 &&
        record.temperature.some((t) => Math.abs(t - 20.0) > 0.001)
      ) {
        realWeatherCurves++;
      }

      // Fechas @db.Date almacenadas en medianoche UTC exacta (Regla 218)
      const d = record.date;
      const dow = d.getUTCDay();
      const month = d.getUTCMonth();
      const isWknd = dow === 0 || dow === 6 ? 1 : 0;

      for (let h = 0; h < 24; h++) {
        const temp = record.temperature[h] ?? 20.0;
        const tempBin = Math.round(temp);
        const cons = record.totalConsumption[h] ?? 0;

        const key = `${segmentId}|${provinceId}|${dow}|${month}|${h}|${tempBin}|${isWknd}`;

        let bucket = groupedData.get(key);
        if (!bucket) {
          bucket = { sumCons: 0, sumClients: 0, weightedTempSum: 0 };
          groupedData.set(key, bucket);
        }
        bucket.sumCons += cons;
        bucket.sumClients += record.clientCount;
        bucket.weightedTempSum += temp * record.clientCount;
      }
    }

    let X_global: number[][] = [];
    let Y_global: number[] = [];
    const W_global: number[] = [];

    for (const [key, bucket] of groupedData.entries()) {
      if (bucket.sumClients <= 0) continue;
      const [segmentIdStr, provinceIdStr, dowStr, monthStr, hStr, , isWkndStr] = key.split('|');
      const avgTemp = bucket.weightedTempSum / bucket.sumClients;
      const avgY = bucket.sumCons / bucket.sumClients;

      X_global.push([
        parseInt(segmentIdStr, 10),
        parseInt(provinceIdStr, 10),
        parseInt(dowStr, 10),
        parseInt(monthStr, 10),
        parseInt(hStr, 10),
        avgTemp,
        parseInt(isWkndStr, 10),
      ]);
      Y_global.push(avgY);
      W_global.push(bucket.sumClients);
    }

    const totalUniqueBuckets = X_global.length;

    // Muestreo sistemático PPS 100% determinista ponderado por volumen de clientes (sumClients) (Regla 205)
    // Garantiza que cada nodo hoja de ml-cart pondere proporcionalmente al número real de clientes·hora
    const MAX_TRAINING_SAMPLES = 10000;
    if (X_global.length > 0) {
      const combined = X_global.map((x, i) => ({ x, y: Y_global[i], w: W_global[i] }));
      combined.sort((a, b) => {
        for (let j = 0; j < a.x.length; j++) {
          if (a.x[j] !== b.x[j]) return a.x[j] - b.x[j];
        }
        return 0;
      });

      const totalWeight = combined.reduce((acc, item) => acc + item.w, 0);
      const sampleTarget = Math.min(MAX_TRAINING_SAMPLES, Math.max(combined.length, 1000));
      const finalCount = combined.length > MAX_TRAINING_SAMPLES ? MAX_TRAINING_SAMPLES : sampleTarget;

      if (totalWeight > 0 && (combined.length > MAX_TRAINING_SAMPLES || totalWeight > combined.length)) {
        console.log(
          `Client-weighted systematic sampling from ${combined.length} buckets (${totalWeight} client-hours) to ${finalCount}...`
        );
        const weightStep = totalWeight / finalCount;
        const sampledX: number[][] = [];
        const sampledY: number[] = [];
        let cumWeight = combined[0].w;
        let ptr = 0;
        for (let i = 0; i < finalCount; i++) {
          const targetW = (i + 0.5) * weightStep;
          while (ptr < combined.length - 1 && cumWeight < targetW) {
            ptr++;
            cumWeight += combined[ptr].w;
          }
          sampledX.push(combined[ptr].x);
          sampledY.push(combined[ptr].y);
        }
        X_global = sampledX;
        Y_global = sampledY;
      }
    }

    if (X_global.length < 100) {
      return NextResponse.json(
        { error: 'No hay suficientes muestras históricas para entrenar el modelo (< 100)' },
        { status: 400 }
      );
    }

    console.log(`Training model with ${X_global.length} samples...`);
    const regression = new DecisionTreeRegression({ maxDepth: 20 });
    regression.train(X_global, Y_global);

    const trainedAt = new Date().toISOString();
    const meta = {
      trainedAt,
      samplesUsed: X_global.length,
      uniqueBuckets: totalUniqueBuckets,
      rawCurvesCount: totalEligibleCurves,
      provincesTrained: seenProvinces.size,
      realWeatherPct:
        totalEligibleCurves > 0
          ? Math.round((realWeatherCurves / totalEligibleCurves) * 1000) / 10
          : 0,
    };

    const modelJson = {
      ...regression.toJSON(),
      _meta: meta,
    };

    const existingCache = await prisma.forecastModelCache.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let newVersion = 1;
    let savedAt = new Date();
    if (existingCache) {
      newVersion = existingCache.version + 1;
      const updated = await prisma.forecastModelCache.update({
        where: { id: existingCache.id },
        data: {
          modelData: modelJson as any,
          version: newVersion,
        },
      });
      savedAt = updated.updatedAt;
    } else {
      const created = await prisma.forecastModelCache.create({
        data: {
          modelData: modelJson as any,
          version: 1,
        },
      });
      savedAt = created.updatedAt;
    }

    console.log(`Model v${newVersion} trained and saved to database successfully!`);
    return NextResponse.json({
      success: true,
      message: 'Model trained successfully',
      version: newVersion,
      updatedAt: savedAt.toISOString(),
      meta,
    });
  } catch (error) {
    console.error('Cron Train Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
