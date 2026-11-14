import ComprasDashboard from '@/components/compras/ComprasDashboard';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { get12MonthProjectionAction } from '@/app/actions/portfolioProjectionActions';
import { isPpaActiveOnMadridYmd } from '@/lib/ppaEngine';
import { calculateSegment } from '@/lib/services/SegmentService';
import { formatInTimeZone } from 'date-fns-tz';

const CANONICAL_SEGMENTS = [
  'HOGAR 0-5kW',
  'HOGAR 5-10kW',
  'HOGAR 10-15kW',
  'PYME <50 MWh',
  'PYME >50 MWh',
  'VE <15 MWh',
  'VE >15 MWh',
  'VIP',
] as const;

export const dynamic = 'force-dynamic';

function addUtcDaysYmd(ymd: string, deltaDays: number): string {
  const dt = new Date(`${ymd}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().substring(0, 10);
}

export default async function ComprasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (!hasAdminOrBackofficeRole((session.user as any).role)) {
    redirect('/');
  }

  const companyId = await resolveActiveCompanyId(session);
  const todayMadridStr = formatInTimeZone(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  const tomorrowMadridStr = addUtcDaysYmd(todayMadridStr, 1);
  const maxForecastDateStr = addUtcDaysYmd(todayMadridStr, 14);

  const companyContractFilter = companyId
    ? {
        OR: [
          { brand: { companyId } },
          { brandId: null, client: { brand: { companyId } } },
        ],
      }
    : {};

  const [
    activeContractsRows,
    historicalFinalizedCount,
    weatherBounds,
    weatherProvs,
    aggBoundsCompany,
    aggBoundsGlobal,
    aggProvsGlobal,
    realWeatherCountRow,
    loadCurveBounds,
    loadCurveApproxRow,
    lastModelCache,
    kBounds,
    lossTariffs,
    companyPpas,
    recentForecastsRaw,
    projectionResult,
  ] = await Promise.all([
    prisma.contract.findMany({
      where: {
        status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active', 'EN_VIGOR'] },
        AND: [
          { OR: [{ suspendido: false }, { suspendido: null }] },
          ...(companyId ? [companyContractFilter] : []),
        ],
      },
      orderBy: { activationDate: 'desc' },
      select: {
        annualConsumption: true,
        product: { select: { tariff: true } },
        supplyPoint: {
          select: {
            cups: true,
            segment: true,
            tariff: true,
            annualConsumption: true,
            p1c: true,
            cnae: true,
            postalCode: true,
            province: true,
          },
        },
      },
    }),
    prisma.contract.count({
      where: {
        status: { in: ['FINALIZADO', 'Finalizado'] },
        ...companyContractFilter,
      },
    }),
    prisma.weatherHistory.aggregate({
      _count: { _all: true },
      _min: { date: true },
      _max: { date: true },
    }),
    prisma.weatherHistory.groupBy({ by: ['province'] }),
    companyId
      ? prisma.aggregatedLoadCurve.aggregate({
          where: { companyId },
          _count: { _all: true },
          _min: { date: true },
          _max: { date: true },
        })
      : Promise.resolve(null),
    prisma.aggregatedLoadCurve.aggregate({
      _count: { _all: true },
      _min: { date: true },
      _max: { date: true },
    }),
    prisma.aggregatedLoadCurve.groupBy({ by: ['province'] }),
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*)::bigint AS cnt
      FROM "AggregatedLoadCurve"
      WHERE "temperature" IS DISTINCT FROM ARRAY[20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20]::double precision[]
    `,
    prisma.loadCurve.aggregate({
      _min: { date: true },
      _max: { date: true },
    }),
    prisma.$queryRaw<Array<{ approx_rows: bigint }>>`
      SELECT GREATEST(COALESCE(reltuples, 0), 0)::bigint AS approx_rows
      FROM pg_class
      WHERE relname = 'LoadCurve'
    `,
    prisma.forecastModelCache.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { version: true, updatedAt: true, modelData: true },
    }),
    prisma.systemComponentPrice.aggregate({
      where: { component: 'K' },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.regulatedCost.groupBy({
      by: ['tariff'],
      where: { concept: 'PERDIDAS' },
    }),
    prisma.ppa.findMany({
      where: companyId ? { companyId } : {},
      select: {
        id: true,
        name: true,
        type: true,
        subtype: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.demandForecast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    get12MonthProjectionAction(companyId),
  ]);

  // Deduplicación por raíz de 20 caracteres del CUPS y radiografía por segmento (Reglas 124, 188 y 241)
  const uniqueActiveCups = new Set<string>();
  const segStatsMap: Record<
    string,
    { segment: string; clients: number; annualMwh: number; missingGeoCount: number; zeroConsCount: number }
  > = {};
  for (const seg of CANONICAL_SEGMENTS) {
    segStatsMap[seg] = { segment: seg, clients: 0, annualMwh: 0, missingGeoCount: 0, zeroConsCount: 0 };
  }

  for (const row of activeContractsRows) {
    const sp = row.supplyPoint;
    if (!sp?.cups) continue;
    const baseCups = sp.cups.length >= 20 ? sp.cups.substring(0, 20) : sp.cups;
    if (uniqueActiveCups.has(baseCups)) continue;
    uniqueActiveCups.add(baseCups);

    const tariff = sp.tariff || row.product?.tariff || '2.0TD';
    let rawCons = row.annualConsumption ?? sp.annualConsumption ?? 0;
    let consMwh = rawCons > 0 ? rawCons : 0;
    if (tariff.startsWith('2') && consMwh > 500) {
      consMwh = consMwh / 1000;
    }

    const seg = sp.segment || calculateSegment(tariff, consMwh, sp.p1c, sp.cnae);
    const bucket = segStatsMap[seg] || (segStatsMap[seg] = {
      segment: seg,
      clients: 0,
      annualMwh: 0,
      missingGeoCount: 0,
      zeroConsCount: 0,
    });
    bucket.clients += 1;
    bucket.annualMwh += consMwh;
    if (!sp.postalCode && !sp.province) bucket.missingGeoCount += 1;
    if (consMwh <= 0) bucket.zeroConsCount += 1;
  }
  const activeContracts = uniqueActiveCups.size;
  const activePortfolioSegments = Object.values(segStatsMap);

  const activePhysicalPpas = companyPpas.filter(
    (p) => p.type === 'FISICO' && isPpaActiveOnMadridYmd(p, tomorrowMadridStr)
  );
  const activeFinancialPpas = companyPpas.filter(
    (p) => p.type === 'FINANCIERO' && isPpaActiveOnMadridYmd(p, tomorrowMadridStr)
  );

  // Filtrar predicciones recientes pertenecientes a la comercializadora activa
  const matchingForecasts = recentForecastsRaw.filter((f) => {
    const fd = f.forecastData as any;
    if (fd && typeof fd === 'object' && !Array.isArray(fd) && 'companyId' in fd) {
      return !companyId || fd.companyId === companyId;
    }
    return !companyId;
  });

  let initialForecastResult: any = null;
  if (matchingForecasts.length > 0) {
    const latest = matchingForecasts[0];
    const fd = latest.forecastData as any;
    if (fd && typeof fd === 'object' && !Array.isArray(fd) && Array.isArray(fd.finalPrediction)) {
      initialForecastResult = fd;
    }
  }

  const recentForecastHistory = matchingForecasts.slice(0, 8).map((f) => {
    const fd = f.forecastData as any;
    const isRich = fd && typeof fd === 'object' && !Array.isArray(fd);
    return {
      id: f.id,
      targetDate: isRich && fd.targetDate
        ? fd.targetDate
        : f.targetDate.toISOString().substring(0, 10),
      createdAt: f.createdAt.toISOString(),
      totalNetMwh: (f.totalPredicted || 0) / 1000,
      totalGrossMwh: isRich ? (fd.totalGrossPredicted || 0) / 1000 : (f.totalPredicted || 0) / 1000,
      totalPpaPhysicalMwh: isRich ? (fd.totalPpaPhysical || 0) / 1000 : 0,
    };
  });

  const totalAggGlobal = aggBoundsGlobal._count._all;
  const realWeatherCount = Number(realWeatherCountRow[0]?.cnt || 0);
  const realWeatherPct =
    totalAggGlobal > 0 ? Math.round((realWeatherCount / totalAggGlobal) * 1000) / 10 : 0;

  const modelMeta =
    lastModelCache?.modelData &&
    typeof lastModelCache.modelData === 'object' &&
    (lastModelCache.modelData as any)._meta
      ? (lastModelCache.modelData as any)._meta
      : null;

  const effectiveAggBounds =
    aggBoundsCompany && aggBoundsCompany._count._all > 0
      ? aggBoundsCompany
      : aggBoundsGlobal;

  const auditStats = {
    activeContracts,
    historicalFinalizedCount,
    activePortfolioSegments,
    loadCurveApproxRows: Number(loadCurveApproxRow[0]?.approx_rows || 0),
    loadCurveMinDate: loadCurveBounds._min.date?.toISOString().substring(0, 10) || null,
    loadCurveMaxDate: loadCurveBounds._max.date?.toISOString().substring(0, 10) || null,
    weatherTotalRows: weatherBounds._count._all,
    weatherProvincesCount: weatherProvs.length,
    weatherMinDate: weatherBounds._min.date?.toISOString().substring(0, 10) || null,
    weatherMaxDate: weatherBounds._max.date?.toISOString().substring(0, 10) || null,
    aggTotalRows: effectiveAggBounds._count._all,
    aggProvincesCount: aggProvsGlobal.length,
    aggMinDate: effectiveAggBounds._min.date?.toISOString().substring(0, 10) || null,
    aggMaxDate: effectiveAggBounds._max.date?.toISOString().substring(0, 10) || null,
    realWeatherPct,
    modelTrained: Boolean(lastModelCache),
    modelVersion: lastModelCache?.version || null,
    modelMeta,
    kDaysCount: kBounds._count._all,
    kMaxDate: kBounds._max.date?.toISOString().substring(0, 10) || null,
    lossTariffsCount: lossTariffs.length,
    activePhysicalPpasCount: activePhysicalPpas.length,
    activeFinancialPpasCount: activeFinancialPpas.length,
    totalPpasCount: companyPpas.length,
  };

  const projectionData = projectionResult.success ? projectionResult.data : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ComprasDashboard
        initialForecastResult={initialForecastResult}
        recentForecastHistory={recentForecastHistory}
        activeContracts={activeContracts}
        lastTrainingDate={lastModelCache?.updatedAt?.toISOString() || null}
        projectionData={projectionData}
        auditStats={auditStats}
        todayDateStr={todayMadridStr}
        defaultTomorrowDateStr={tomorrowMadridStr}
        maxForecastDateStr={maxForecastDateStr}
      />
    </div>
  );
}
