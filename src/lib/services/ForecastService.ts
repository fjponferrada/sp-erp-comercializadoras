import { prisma } from '../prisma';
import {
  getProvinceCodeByName,
  getProvinceGeoByName,
  normalizeProvinceName,
  PROVINCE_NAMES,
} from './ProvinceService';
import { calculateSegment } from './SegmentService';
import { DecisionTreeRegression } from 'ml-cart';
import { getPeriodoREE } from './InternalBillingEngine';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  calculatePpaHourlyMwh,
  getClockHourOccurrencesInMonth,
  isPpaActiveOnMadridYmd,
} from '../ppaEngine';

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

function toUtcDateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addUtcDaysYmd(ymd: string, deltaDays: number): string {
  const dt = toUtcDateFromYmd(ymd);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().substring(0, 10);
}

async function fetchForecastWeather(
  lat: number,
  lon: number,
  targetDate: string,
  daysAhead: number
): Promise<number[]> {
  try {
    const forecastDays = Math.min(16, Math.max(3, daysAhead + 2));
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m&timezone=Europe%2FMadrid&forecast_days=${forecastDays}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
    const data = await res.json();

    const times: string[] = data.hourly?.time || [];
    const temps: number[] = data.hourly?.temperature_2m || [];

    const byHourSum = new Array(24).fill(0);
    const byHourCount = new Array(24).fill(0);
    for (let i = 0; i < times.length; i++) {
      if (times[i]?.startsWith(targetDate) && Number.isFinite(temps[i])) {
        const h = parseInt(times[i].substring(11, 13), 10);
        if (h >= 0 && h < 24) {
          byHourSum[h] += temps[i];
          byHourCount[h] += 1;
        }
      }
    }

    const validHours = byHourCount.filter((c) => c > 0).length;
    if (validHours === 0) {
      return new Array(24).fill(20.0);
    }

    const result: number[] = new Array(24).fill(20.0);
    let lastKnown = 20.0;
    for (let h = 0; h < 24; h++) {
      if (byHourCount[h] > 0) {
        result[h] = byHourSum[h] / byHourCount[h];
        lastKnown = result[h];
      } else {
        result[h] = lastKnown;
      }
    }
    // Si la hora 00..02 estaba vacía (ej. cambio horario primavera), propagar hacia atrás el primer valor real
    const firstValidIdx = byHourCount.findIndex((c) => c > 0);
    if (firstValidIdx > 0) {
      for (let h = 0; h < firstValidIdx; h++) {
        result[h] = result[firstValidIdx];
      }
    }

    return result;
  } catch (e) {
    console.error('Error fetching forecast weather:', e);
    return new Array(24).fill(20.0);
  }
}

function selectActiveLossRecord<
  T extends { tariff: string; validFrom: Date; validTo: Date | null }
>(records: T[], tariff: string, targetUtc: Date): T | undefined {
  const tMs = targetUtc.getTime();
  const candidates = records.filter((r) => r.tariff === tariff);
  if (candidates.length === 0) return undefined;

  const active = candidates.find((r) => {
    const fromMs = r.validFrom.getTime();
    const toMs = r.validTo ? r.validTo.getTime() : Number.MAX_SAFE_INTEGER;
    return tMs >= fromMs && tMs <= toMs;
  });
  return active || candidates[0];
}

function computeHourlyLossPct(
  boeRec: any | undefined,
  madridHourDates: Date[],
  hour: number,
  tariff: string,
  postalPrefix: string,
  kArray: number[]
): number {
  if (!boeRec) return 0;
  const pStr = getPeriodoREE(madridHourDates[hour], tariff, postalPrefix);
  const boeVal = boeRec[pStr.toLowerCase()] as number | null | undefined;
  if (boeVal === null || boeVal === undefined) return 0;

  const isKQuarterly = kArray.length >= 96;
  const currentK = isKQuarterly
    ? ((kArray[hour * 4] ?? 1) +
        (kArray[hour * 4 + 1] ?? 1) +
        (kArray[hour * 4 + 2] ?? 1) +
        (kArray[hour * 4 + 3] ?? 1)) /
      4
    : (kArray[hour] ?? 1);

  let baseLoss = boeVal;
  if (baseLoss > 1.0 && baseLoss <= 2.0) baseLoss -= 1.0;
  else if (baseLoss > 2.0) baseLoss /= 100.0;

  return baseLoss * currentK;
}

export interface ForecastOptions {
  targetDate?: string;
  userId?: string | null;
}

export async function generateTomorrowForecast(
  companyId?: string | null,
  options?: ForecastOptions
) {
  // Calcular fecha objetivo estrictamente en calendario peninsular español (Europe/Madrid)
  const timeZone = 'Europe/Madrid';
  const todayMadridStr = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
  const defaultTomorrowStr = addUtcDaysYmd(todayMadridStr, 1);

  let targetDateStr = defaultTomorrowStr;
  if (options?.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(options.targetDate)) {
    const minAllowed = todayMadridStr;
    const maxAllowed = addUtcDaysYmd(todayMadridStr, 14);
    if (options.targetDate >= minAllowed && options.targetDate <= maxAllowed) {
      targetDateStr = options.targetDate;
    }
  }

  const targetUtcDate = toUtcDateFromYmd(targetDateStr);
  const todayUtcDate = toUtcDateFromYmd(todayMadridStr);
  const daysAhead = Math.max(
    0,
    Math.round((targetUtcDate.getTime() - todayUtcDate.getTime()) / 86_400_000)
  );

  const [tYear, tMonth1to12, tDay] = targetDateStr.split('-').map(Number);
  const targetDow = targetUtcDate.getUTCDay();
  const targetMonth0to11 = targetUtcDate.getUTCMonth();
  const targetIsWknd = targetDow === 0 || targetDow === 6 ? 1 : 0;

  // Instantes exactos de cada hora de reloj en Europe/Madrid para getPeriodoREE (evita el desfase +1h/+2h de setUTCHours)
  const madridHourDates = Array.from({ length: 24 }, (_, h) =>
    fromZonedTime(`${targetDateStr}T${String(h).padStart(2, '0')}:30:00`, timeZone)
  );

  console.log(`Generating forecast for ${targetDateStr} (companyId=${companyId || 'ALL'})...`);

  // 1. Contratos activos aislados por comercializadora, excluyendo suspendidos por corte E2/impago (Regla 59)
  const activeContractsRaw = await prisma.contract.findMany({
    where: {
      status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active', 'EN_VIGOR'] },
      AND: [
        { OR: [{ suspendido: false }, { suspendido: null }] },
        ...(companyId
          ? [
              {
                OR: [
                  { brand: { companyId } },
                  { brandId: null, client: { brand: { companyId } } },
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      supplyPoint: true,
      product: { select: { tariff: true } },
    },
    orderBy: { activationDate: 'desc' },
  });

  // Deduplicar por la raíz física de 20 caracteres del CUPS (Reglas 124 y 241)
  const seenBaseCups = new Set<string>();
  const activeContracts = [];
  for (const c of activeContractsRaw) {
    if (!c.supplyPoint?.cups) continue;
    const baseCups =
      c.supplyPoint.cups.length >= 20
        ? c.supplyPoint.cups.substring(0, 20)
        : c.supplyPoint.cups;
    if (seenBaseCups.has(baseCups)) continue;
    seenBaseCups.add(baseCups);
    activeContracts.push(c);
  }

  const currentClients: Record<string, number> = {};
  const vipVeContracts: Array<{
    contract: (typeof activeContracts)[number];
    segment: string;
    tariff: string;
    postalPrefix: string;
  }> = [];

  for (const c of activeContracts) {
    if (!c.supplyPoint) continue;

    const tariff = c.supplyPoint.tariff || c.product?.tariff || '2.0TD';
    const segment =
      c.supplyPoint.segment ||
      calculateSegment(
        tariff,
        c.annualConsumption ?? c.supplyPoint.annualConsumption,
        c.p1c ?? c.supplyPoint.p1c,
        c.supplyPoint.cnae
      );

    const prov = normalizeProvinceName(c.supplyPoint.province, c.supplyPoint.postalCode);
    const postalPrefix = getProvinceCodeByName(prov);

    if (['VIP', 'VE <15 MWh', 'VE >15 MWh'].includes(segment)) {
      vipVeContracts.push({ contract: c, segment, tariff, postalPrefix });
      continue;
    }

    const key = `${segment}|${prov}|${tariff}`;
    currentClients[key] = (currentClients[key] || 0) + 1;
  }

  // 1A. Obtener coeficientes de Pérdidas (BOE vigente + Factor K: último día equivalente COMPODEM con fallback a -364d)
  const regulatedCosts = await prisma.regulatedCost.findMany({
    where: { concept: 'PERDIDAS' },
    orderBy: { validFrom: 'desc' },
  });

  const recentK = await prisma.systemComponentPrice.findMany({
    where: {
      component: 'K',
      date: {
        gte: toUtcDateFromYmd(addUtcDaysYmd(targetDateStr, -35)),
        lte: targetUtcDate,
      },
    },
    orderBy: { date: 'desc' },
    take: 35,
  });

  let kRecord = recentK.find((r) => r.date.getUTCDay() === targetDow) || null;
  if (!kRecord) {
    const kExactLastYear = toUtcDateFromYmd(addUtcDaysYmd(targetDateStr, -364));
    kRecord = await prisma.systemComponentPrice.findFirst({
      where: { component: 'K', date: kExactLastYear },
    });
  }
  if (!kRecord) {
    kRecord =
      recentK[0] ||
      (await prisma.systemComponentPrice.findFirst({
        where: { component: 'K', date: { lte: targetUtcDate } },
        orderBy: { date: 'desc' },
      }));
  }

  const kArray =
    kRecord && kRecord.values && kRecord.values.length >= 24
      ? (kRecord.values as number[])
      : new Array(24).fill(1);

  // 1B. Cargar modelo de Árbol de Decisión pre-entrenado desde caché BD
  const cachedModel = await prisma.forecastModelCache.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  let regression: DecisionTreeRegression | null = null;
  if (cachedModel && cachedModel.modelData) {
    try {
      // @ts-ignore
      regression = DecisionTreeRegression.load(cachedModel.modelData);
    } catch (e) {
      console.error('Failed to load AI model from cache:', e);
    }
  }

  const grossPrediction: number[] = new Array(24).fill(0);
  const vipPredictions: number[] = new Array(24).fill(0);
  const weatherCache: Record<string, number[]> = {};
  const segmentBreakdown: Record<string, number[]> = {};
  for (const s of SEGMENTS) segmentBreakdown[s] = new Array(24).fill(0);

  const neededProvinces = Array.from(
    new Set(Object.keys(currentClients).map((k) => k.split('|')[1]))
  );
  await Promise.all(
    neededProvinces.map(async (province) => {
      const geo = getProvinceGeoByName(province);
      weatherCache[province] = await fetchForecastWeather(
        geo.lat,
        geo.lon,
        targetDateStr,
        daysAhead
      );
    })
  );

  // --- 2. CÁLCULO INDIVIDUAL SDA PARA VIP/VE ---
  if (vipVeContracts.length > 0) {
    const cupsList = vipVeContracts
      .map(({ contract }) => {
        const cups = contract.supplyPoint?.cups || '';
        return cups.length >= 20 ? cups.substring(0, 20) : cups;
      })
      .filter(Boolean);

    if (cupsList.length > 0) {
      const curves: any[] = await prisma.$queryRaw`
        SELECT cups, date, readings 
        FROM (
          SELECT cups, date, readings, ROW_NUMBER() OVER(PARTITION BY cups ORDER BY date DESC) as rn
          FROM "LoadCurve"
          WHERE SUBSTRING(cups, 1, 20) = ANY(string_to_array(${cupsList.join(',')}, ','))
            AND type = 'CONSUMPTION'
            AND date < ${targetUtcDate}
        ) t
        WHERE rn <= 60
      `;

      const curvesByCups: Record<string, any[]> = {};
      for (const row of curves) {
        const bCups = row.cups.length >= 20 ? row.cups.substring(0, 20) : row.cups;
        if (!curvesByCups[bCups]) curvesByCups[bCups] = [];
        curvesByCups[bCups].push(row);
      }

      for (const { contract, segment, tariff, postalPrefix } of vipVeContracts) {
        const cups = contract.supplyPoint?.cups || '';
        const baseCups = cups.length >= 20 ? cups.substring(0, 20) : cups;
        const boeRec = selectActiveLossRecord(regulatedCosts, tariff, targetUtcDate);

        const history = curvesByCups[baseCups] || [];
        const similarDays = history
          .filter((r) => new Date(r.date).getUTCDay() === targetDow)
          .slice(0, 3);

        if (similarDays.length > 0) {
          for (let h = 0; h < 24; h++) {
            let sum = 0;
            for (const d of similarDays) {
              if (d.readings && d.readings.length >= 96) {
                sum +=
                  (d.readings[h * 4] || 0) +
                  (d.readings[h * 4 + 1] || 0) +
                  (d.readings[h * 4 + 2] || 0) +
                  (d.readings[h * 4 + 3] || 0);
              } else if (d.readings && d.readings.length >= 24) {
                sum += d.readings[h] || 0;
              }
            }
            const avgHour = sum / similarDays.length;
            const lossPct = computeHourlyLossPct(
              boeRec,
              madridHourDates,
              h,
              tariff,
              postalPrefix,
              kArray
            );
            const finalVal = avgHour * (1 + lossPct);

            vipPredictions[h] += finalVal;
            grossPrediction[h] += finalVal;
            if (segmentBreakdown[segment]) segmentBreakdown[segment][h] += finalVal;
          }
        }
      }
    }
  }

  // --- 3. CÁLCULO IA PARA HOGARES Y PYMES ---
  if (regression) {
    for (const [key, activeCount] of Object.entries(currentClients)) {
      if (activeCount === 0) continue;

      const [segment, province, tariff] = key.split('|');
      const postalPrefix = getProvinceCodeByName(province);
      const boeRec = selectActiveLossRecord(regulatedCosts, tariff, targetUtcDate);
      const tomorrowTemps = weatherCache[province] || new Array(24).fill(20.0);

      const segmentId = SEGMENTS.indexOf(segment);
      const provinceId = PROVINCE_NAMES.indexOf(province);
      if (segmentId < 0 || provinceId < 0) continue;

      const X_test: number[][] = [];
      for (let h = 0; h < 24; h++) {
        X_test.push([
          segmentId,
          provinceId,
          targetDow,
          targetMonth0to11,
          h,
          tomorrowTemps[h],
          targetIsWknd,
        ]);
      }

      const Y_pred = regression.predict(X_test);

      for (let h = 0; h < 24; h++) {
        const lossPct = computeHourlyLossPct(
          boeRec,
          madridHourDates,
          h,
          tariff,
          postalPrefix,
          kArray
        );
        const clusterPrediction = Math.max(0, Y_pred[h]) * activeCount * (1 + lossPct);
        grossPrediction[h] += clusterPrediction;
        if (segmentBreakdown[segment]) segmentBreakdown[segment][h] += clusterPrediction;
      }
    }
  }

  // --- 4. DESCUENTO EXCLUSIVO DE PPAs FÍSICOS ACTIVOS (REGLAS 143 Y 234) ---
  // ÚNICAMENTE los PPAs FÍSICOS asignan energía bilateral del productor al comprador reduciendo la compra en OMIE.
  // Los PPAs FINANCIEROS (CfD) liquidan por diferencias y JAMÁS reducen la energía física a comprar en OMIE.
  const allCompanyPpas = await prisma.ppa.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
    },
  });

  const activePhysicalPpas = allCompanyPpas.filter(
    (p) => p.type === 'FISICO' && isPpaActiveOnMadridYmd(p, targetDateStr)
  );
  const activeFinancialPpasCount = allCompanyPpas.filter(
    (p) => p.type === 'FINANCIERO' && isPpaActiveOnMadridYmd(p, targetDateStr)
  ).length;

  const hourOccurrences = getClockHourOccurrencesInMonth(tYear, tMonth1to12);

  const ppaPhysicalPredictions: number[] = new Array(24).fill(0); // en kWh
  for (const ppa of activePhysicalPpas) {
    for (let h = 0; h < 24; h++) {
      const mwh = calculatePpaHourlyMwh(
        ppa,
        tYear,
        tMonth1to12,
        tDay,
        h,
        hourOccurrences
      );
      ppaPhysicalPredictions[h] += mwh * 1000;
    }
  }

  const finalPrediction: number[] = new Array(24).fill(0); // Compra neta física a ofertar en OMIE (kWh)
  for (let h = 0; h < 24; h++) {
    finalPrediction[h] = Math.max(0, grossPrediction[h] - ppaPhysicalPredictions[h]);
  }

  const totalGrossPredicted = grossPrediction.reduce((a, b) => a + b, 0);
  const totalPpaPhysical = ppaPhysicalPredictions.reduce((a, b) => a + b, 0);
  const totalPred = finalPrediction.reduce((a, b) => a + b, 0);

  const payload = {
    version: 2,
    companyId: companyId || null,
    targetDate: targetDateStr,
    finalPrediction,
    grossPrediction,
    ppaPhysicalPredictions,
    totalPredicted: totalPred,
    totalGrossPredicted,
    totalPpaPhysical,
    activePhysicalPpasCount: activePhysicalPpas.length,
    activeFinancialPpasCount,
    activeContractsCount: activeContracts.length,
    vipPredictions,
    segmentBreakdown,
  };

  // Evitar duplicados en DemandForecast si se recalcula la misma fecha objetivo para la misma comercializadora
  const existingSameTarget = await prisma.demandForecast.findMany({
    where: { targetDate: targetUtcDate },
    orderBy: { createdAt: 'desc' },
  });
  const matchingExisting = existingSameTarget.find((row) => {
    const fd = row.forecastData as any;
    if (fd && typeof fd === 'object' && !Array.isArray(fd) && 'companyId' in fd) {
      return (fd.companyId || null) === (companyId || null);
    }
    return !companyId;
  });

  if (matchingExisting) {
    await prisma.demandForecast.update({
      where: { id: matchingExisting.id },
      data: {
        executionDate: new Date(),
        forecastData: payload as any,
        totalPredicted: totalPred,
        userId: options?.userId || matchingExisting.userId || null,
      },
    });
  } else {
    await prisma.demandForecast.create({
      data: {
        targetDate: targetUtcDate,
        forecastData: payload as any,
        totalPredicted: totalPred,
        vipOverride: null,
        userId: options?.userId || null,
      },
    });
  }

  return payload;
}

/**
 * Ejecuta una auditoría retrospectiva (Backtesting) sobre una fecha histórica con consumo real consolidado
 * en AggregatedLoadCurve, comparando hora a hora la curva predicha por IA + SDA frente a la demanda real medida.
 */
export async function runHistoricalBacktest(
  targetDateStr: string,
  companyId?: string | null
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    throw new Error('Formato de fecha inválido (debe ser YYYY-MM-DD)');
  }

  const targetUtc = toUtcDateFromYmd(targetDateStr);
  const dow = targetUtc.getUTCDay();
  const month0to11 = targetUtc.getUTCMonth();
  const isWknd = dow === 0 || dow === 6 ? 1 : 0;

  let actualRows = companyId
    ? await prisma.aggregatedLoadCurve.findMany({
        where: { date: targetUtc, companyId },
      })
    : [];

  let usedGlobalPool = false;
  if (actualRows.length === 0) {
    actualRows = await prisma.aggregatedLoadCurve.findMany({
      where: { date: targetUtc },
    });
    usedGlobalPool = Boolean(companyId && actualRows.length > 0);
  }

  if (actualRows.length === 0) {
    throw new Error(
      `No existen curvas históricas consolidadas para la fecha ${targetDateStr}. Selecciona un día dentro del rango histórico disponible.`
    );
  }

  const cachedModel = await prisma.forecastModelCache.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!cachedModel?.modelData) {
    throw new Error('El modelo de IA aún no ha sido entrenado.');
  }

  // @ts-ignore
  const regression = DecisionTreeRegression.load(cachedModel.modelData);

  // Días equivalentes anteriores (-7d, -14d, -21d) estrictamente previos para SDA de VIP/VE
  const priorDates = [
    toUtcDateFromYmd(addUtcDaysYmd(targetDateStr, -7)),
    toUtcDateFromYmd(addUtcDaysYmd(targetDateStr, -14)),
    toUtcDateFromYmd(addUtcDaysYmd(targetDateStr, -21)),
  ];
  const priorVipVeRows = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: { in: priorDates },
      segment: { in: ['VIP', 'VE <15 MWh', 'VE >15 MWh'] },
      ...(!usedGlobalPool && companyId ? { companyId } : {}),
    },
  });

  // Agrupar consumo medio por cliente en los 3 días previos equivalentes por (segment|province|tariff)
  const sdaPerClientByKey = new Map<string, { sumPerClient: number[]; days: number }>();
  const priorByDateKey = new Map<string, { cons: number[]; clients: number }>();
  for (const r of priorVipVeRows) {
    if (r.clientCount <= 0) continue;
    const prov = normalizeProvinceName(r.province);
    const dk = `${r.date.toISOString().slice(0, 10)}|${r.segment}|${prov}|${r.tariff}`;
    const entry = priorByDateKey.get(dk) || { cons: new Array(24).fill(0), clients: 0 };
    for (let h = 0; h < 24; h++) entry.cons[h] += r.totalConsumption[h] || 0;
    entry.clients += r.clientCount;
    priorByDateKey.set(dk, entry);
  }
  for (const [dk, entry] of priorByDateKey.entries()) {
    if (entry.clients <= 0) continue;
    const [, seg, prov, tar] = dk.split('|');
    const k = `${seg}|${prov}|${tar}`;
    const agg = sdaPerClientByKey.get(k) || { sumPerClient: new Array(24).fill(0), days: 0 };
    for (let h = 0; h < 24; h++) {
      agg.sumPerClient[h] += entry.cons[h] / entry.clients;
    }
    agg.days += 1;
    sdaPerClientByKey.set(k, agg);
  }

  // Pérdidas reguladas BOE y Factor K real de esa fecha (o equivalente) para elevar ambas series a Barras de Central (BC)
  const [boeLossesAll, exactKRec] = await Promise.all([
    prisma.regulatedCost.findMany({ where: { concept: 'PERDIDAS' } }),
    prisma.systemComponentPrice.findFirst({ where: { component: 'K', date: targetUtc } }),
  ]);
  const kArray: number[] = exactKRec?.values?.length ? exactKRec.values : new Array(24).fill(1.0);
  const madridHourDates = Array.from({ length: 24 }, (_, h) =>
    fromZonedTime(`${targetDateStr}T${String(h).padStart(2, '0')}:30:00`, 'Europe/Madrid')
  );

  const realHourlyKwh = new Array(24).fill(0);
  const predHourlyKwh = new Array(24).fill(0);
  let totalClientRecords = 0;

  for (const row of actualRows) {
    if (row.clientCount <= 0) continue;
    totalClientRecords += row.clientCount;

    const prov = normalizeProvinceName(row.province);
    const postalPrefix = getProvinceCodeByName(prov);
    const tariff = row.tariff || '2.0TD';
    const boeRec = selectActiveLossRecord(boeLossesAll, tariff, targetUtc);
    const lossMultipliers = Array.from(
      { length: 24 },
      (_, h) => 1 + computeHourlyLossPct(boeRec, madridHourDates, h, tariff, postalPrefix, kArray)
    );

    for (let h = 0; h < 24; h++) {
      realHourlyKwh[h] += (row.totalConsumption[h] || 0) * lossMultipliers[h];
    }

    if (['VIP', 'VE <15 MWh', 'VE >15 MWh'].includes(row.segment)) {
      const sda = sdaPerClientByKey.get(`${row.segment}|${prov}|${row.tariff}`);
      if (sda && sda.days > 0) {
        for (let h = 0; h < 24; h++) {
          predHourlyKwh[h] +=
            (sda.sumPerClient[h] / sda.days) * row.clientCount * lossMultipliers[h];
        }
      } else {
        for (let h = 0; h < 24; h++) {
          predHourlyKwh[h] += (row.totalConsumption[h] || 0) * lossMultipliers[h];
        }
      }
      continue;
    }

    const segmentId = SEGMENTS.indexOf(row.segment);
    const provinceId = PROVINCE_NAMES.indexOf(prov);
    if (segmentId < 0 || provinceId < 0) continue;

    const X_test: number[][] = [];
    for (let h = 0; h < 24; h++) {
      const temp = row.temperature?.[h] ?? 20.0;
      X_test.push([segmentId, provinceId, dow, month0to11, h, temp, isWknd]);
    }
    const Y_pred = regression.predict(X_test);
    for (let h = 0; h < 24; h++) {
      predHourlyKwh[h] += Math.max(0, Y_pred[h]) * row.clientCount * lossMultipliers[h];
    }
  }

  let absErrSumMw = 0;
  let apeSum = 0;
  let apeHours = 0;

  const hourlyComparison = Array.from({ length: 24 }, (_, h) => {
    const realMw = realHourlyKwh[h] / 1000;
    const predMw = predHourlyKwh[h] / 1000;
    const absErr = Math.abs(predMw - realMw);
    absErrSumMw += absErr;
    if (realMw > 0.01) {
      apeSum += absErr / realMw;
      apeHours++;
    }
    return {
      hora: `${String(h + 1).padStart(2, '0')}:00`,
      realMw: Math.round(realMw * 1000) / 1000,
      predMw: Math.round(predMw * 1000) / 1000,
      diffMw: Math.round((predMw - realMw) * 1000) / 1000,
    };
  });

  const totalRealMwh = realHourlyKwh.reduce((a, b) => a + b, 0) / 1000;
  const totalPredMwh = predHourlyKwh.reduce((a, b) => a + b, 0) / 1000;
  const maeMw = absErrSumMw / 24;
  const mapePct = apeHours > 0 ? (apeSum / apeHours) * 100 : 0;
  const dailyBiasPct =
    totalRealMwh > 0 ? ((totalPredMwh - totalRealMwh) / totalRealMwh) * 100 : 0;

  return {
    targetDate: targetDateStr,
    usedGlobalPool,
    evaluatedSupplies: totalClientRecords,
    totalRealMwh: Math.round(totalRealMwh * 100) / 100,
    totalPredMwh: Math.round(totalPredMwh * 100) / 100,
    maeMw: Math.round(maeMw * 1000) / 1000,
    mapePct: Math.round(mapePct * 100) / 100,
    dailyBiasPct: Math.round(dailyBiasPct * 100) / 100,
    hourlyComparison,
  };
}
