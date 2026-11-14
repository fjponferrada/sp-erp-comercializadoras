import { prisma } from '../prisma';
import {
  getProvinceGeoByName,
  normalizeProvinceName,
  PROVINCE_NAMES,
} from './ProvinceService';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS_PER_REQUEST = 365;
const PROVINCES_PER_BATCH = 10;

function toMadridYmd(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

function toUtcDateFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const dt = toUtcDateFromYmd(ymd);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().substring(0, 10);
}

function diffDaysInclusive(startYmd: string, endYmd: string): number {
  const ms = toUtcDateFromYmd(endYmd).getTime() - toUtcDateFromYmd(startYmd).getTime();
  return Math.floor(ms / DAY_MS) + 1;
}

/**
 * Convierte las series horarias devueltas por Open-Meteo (Europe/Madrid) en vectores diarios de 24 horas exactas,
 * resolviendo días de cambio horario (23h marzo interpolando 02:00 y 25h octubre promediando la hora repetida).
 */
function parseHourlyPayloadToDailyMap(
  times: string[] | undefined,
  temps: Array<number | null> | undefined
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  if (!times || !temps || times.length === 0) return result;

  const byDayHour = new Map<string, { sums: number[]; counts: number[] }>();

  for (let i = 0; i < times.length; i++) {
    const tStr = times[i];
    const val = temps[i];
    if (!tStr || tStr.length < 13 || val === null || val === undefined || !Number.isFinite(val)) {
      continue;
    }
    const dayYmd = tStr.substring(0, 10);
    const hour = parseInt(tStr.substring(11, 13), 10);
    if (hour < 0 || hour > 23) continue;

    let entry = byDayHour.get(dayYmd);
    if (!entry) {
      entry = { sums: new Array(24).fill(0), counts: new Array(24).fill(0) };
      byDayHour.set(dayYmd, entry);
    }
    entry.sums[hour] += val;
    entry.counts[hour] += 1;
  }

  for (const [dayYmd, entry] of byDayHour.entries()) {
    const validHours = entry.counts.filter((c) => c > 0).length;
    if (validHours === 0) continue;

    const arr: Array<number | null> = new Array(24).fill(null);
    for (let h = 0; h < 24; h++) {
      if (entry.counts[h] > 0) {
        arr[h] = Math.round((entry.sums[h] / entry.counts[h]) * 100) / 100;
      }
    }

    // Interpolación/relleno defensivo (p. ej. salto 02:00 en cambio horario de primavera o última hora pendiente)
    for (let h = 0; h < 24; h++) {
      if (arr[h] !== null) continue;
      let prev: number | null = null;
      let next: number | null = null;
      for (let p = h - 1; p >= 0; p--) {
        if (arr[p] !== null) {
          prev = arr[p];
          break;
        }
      }
      for (let n = h + 1; n < 24; n++) {
        if (arr[n] !== null) {
          next = arr[n];
          break;
        }
      }
      if (prev !== null && next !== null) arr[h] = Math.round(((prev + next) / 2) * 100) / 100;
      else if (prev !== null) arr[h] = prev;
      else if (next !== null) arr[h] = next;
      else arr[h] = 15.0;
    }

    result.set(dayYmd, arr as number[]);
  }

  return result;
}

async function fetchOpenMeteoArchiveBatch(
  provinces: string[],
  startYmd: string,
  endYmd: string
): Promise<Array<{ date: Date; province: string; temperatures: number[] }>> {
  const geos = provinces.map((name) => ({ name, geo: getProvinceGeoByName(name) }));
  const lats = geos.map((g) => g.geo.lat.toFixed(4)).join(',');
  const lons = geos.map((g) => g.geo.lon.toFixed(4)).join(',');

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lats}&longitude=${lons}` +
    `&start_date=${startYmd}&end_date=${endYmd}` +
    `&hourly=temperature_2m&timezone=Europe%2FMadrid`;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      if (!res.ok) {
        throw new Error(`Open-Meteo Archive HTTP ${res.status}`);
      }
      const json = await res.json();
      const payloads = Array.isArray(json) ? json : [json];

      const rows: Array<{ date: Date; province: string; temperatures: number[] }> = [];
      for (let idx = 0; idx < geos.length; idx++) {
        const item = payloads[idx];
        if (!item?.hourly) continue;
        const dailyMap = parseHourlyPayloadToDailyMap(
          item.hourly.time,
          item.hourly.temperature_2m
        );
        for (const [dayYmd, temps] of dailyMap.entries()) {
          rows.push({
            date: toUtcDateFromYmd(dayYmd),
            province: geos[idx].name,
            temperatures: temps,
          });
        }
      }
      return rows;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }

  console.error(
    `[WeatherSyncService] Fallo descargando clima histórico (${startYmd}..${endYmd}):`,
    lastErr
  );
  return [];
}

export class WeatherSyncService {
  /**
   * Garantiza que WeatherHistory contenga las temperaturas horarias reales (Open-Meteo Archive)
   * para las provincias solicitadas en el rango [startYmd, endYmd] (acotado hasta ayer Europe/Madrid).
   */
  static async syncWeatherHistoryRange(
    startYmd: string,
    endYmd: string,
    requestedProvinces?: string[]
  ): Promise<{ inserted: number; checkedDays: number }> {
    const yesterdayYmd = addDaysYmd(toMadridYmd(new Date()), -1);
    const effectiveEndYmd = endYmd > yesterdayYmd ? yesterdayYmd : endYmd;
    if (startYmd > effectiveEndYmd) {
      return { inserted: 0, checkedDays: 0 };
    }

    const canonicalProvinces = Array.from(
      new Set(
        (requestedProvinces && requestedProvinces.length > 0
          ? requestedProvinces
          : PROVINCE_NAMES
        ).map((p) => normalizeProvinceName(p))
      )
    );

    const startUtc = toUtcDateFromYmd(startYmd);
    const endUtc = toUtcDateFromYmd(effectiveEndYmd);
    const expectedDays = diffDaysInclusive(startYmd, effectiveEndYmd);

    // Comprobación rápida por provincia para no repetir descargas ya consolidadas en PostgreSQL
    const existingCounts = await prisma.weatherHistory.groupBy({
      by: ['province'],
      where: {
        date: { gte: startUtc, lte: endUtc },
        province: { in: canonicalProvinces },
      },
      _count: { _all: true },
    });

    const countByProvince = new Map<string, number>();
    for (const row of existingCounts) {
      countByProvince.set(row.province, row._count._all);
    }

    const missingProvinces = canonicalProvinces.filter(
      (prov) => (countByProvince.get(prov) || 0) < expectedDays
    );

    if (missingProvinces.length === 0) {
      return { inserted: 0, checkedDays: expectedDays };
    }

    // Si las provincias incompletas ya tienen casi todo el histórico y solo les faltan los últimos días,
    // acotamos la ventana desde el mínimo de sus fechas máximas para acelerar sincronizaciones diarias.
    let fetchStartYmd = startYmd;
    if (expectedDays > 45) {
      const perProvBounds = await prisma.weatherHistory.groupBy({
        by: ['province'],
        where: {
          date: { gte: startUtc, lte: endUtc },
          province: { in: missingProvinces },
        },
        _min: { date: true },
        _max: { date: true },
        _count: { _all: true },
      });

      if (perProvBounds.length === missingProvinces.length) {
        let canNarrowTail = true;
        let earliestNextNeededYmd = effectiveEndYmd;
        for (const b of perProvBounds) {
          const minD = b._min.date?.toISOString().substring(0, 10);
          const maxD = b._max.date?.toISOString().substring(0, 10);
          if (!minD || !maxD || minD > startYmd) {
            canNarrowTail = false;
            break;
          }
          const coveredSpan = diffDaysInclusive(minD, maxD);
          if (b._count._all < coveredSpan) {
            canNarrowTail = false;
            break;
          }
          const nextDay = addDaysYmd(maxD, 1);
          if (nextDay < earliestNextNeededYmd) earliestNextNeededYmd = nextDay;
        }
        if (canNarrowTail && earliestNextNeededYmd > fetchStartYmd) {
          fetchStartYmd = earliestNextNeededYmd;
        }
      }
    }

    let totalInserted = 0;

    // Particionar el rango temporal en bloques <= 365 días y lotes de 10 provincias
    let chunkStartYmd = fetchStartYmd;
    while (chunkStartYmd <= effectiveEndYmd) {
      const candidateEnd = addDaysYmd(chunkStartYmd, MAX_DAYS_PER_REQUEST - 1);
      const chunkEndYmd = candidateEnd < effectiveEndYmd ? candidateEnd : effectiveEndYmd;

      for (let i = 0; i < missingProvinces.length; i += PROVINCES_PER_BATCH) {
        const provBatch = missingProvinces.slice(i, i + PROVINCES_PER_BATCH);
        const fetchedRows = await fetchOpenMeteoArchiveBatch(
          provBatch,
          chunkStartYmd,
          chunkEndYmd
        );

        if (fetchedRows.length > 0) {
          const insertBatchSize = 2500;
          for (let offset = 0; offset < fetchedRows.length; offset += insertBatchSize) {
            const res = await prisma.weatherHistory.createMany({
              data: fetchedRows.slice(offset, offset + insertBatchSize),
              skipDuplicates: true,
            });
            totalInserted += res.count;
          }
        }
      }

      chunkStartYmd = addDaysYmd(chunkEndYmd, 1);
    }

    return { inserted: totalInserted, checkedDays: expectedDays };
  }

  /**
   * Sanea nombres no canónicos de provincias en SupplyPoint y AggregatedLoadCurve (fusionando colisiones sin duplicar),
   * sincroniza todo el histórico meteorológico necesario y actualiza curvas que tenían el fallback plano de 20 °C.
   */
  static async repairHistoricalAggregates(): Promise<{
    provincesNormalized: number;
    weatherInserted: number;
    curvesWeatherUpdated: number;
  }> {
    let provincesNormalized = 0;

    // 1. Normalizar provincias no canónicas en SupplyPoint
    const spDistinct = await prisma.supplyPoint.findMany({
      select: { id: true, province: true, postalCode: true },
    });
    const spUpdatesByTarget = new Map<string, string[]>();
    for (const sp of spDistinct) {
      const canonical = normalizeProvinceName(sp.province, sp.postalCode);
      if (sp.province !== canonical) {
        const list = spUpdatesByTarget.get(canonical) || [];
        list.push(sp.id);
        spUpdatesByTarget.set(canonical, list);
      }
    }
    for (const [canonical, ids] of spUpdatesByTarget.entries()) {
      for (let offset = 0; offset < ids.length; offset += 2000) {
        await prisma.supplyPoint.updateMany({
          where: { id: { in: ids.slice(offset, offset + 2000) } },
          data: { province: canonical },
        });
      }
    }

    // 2. Normalizar provincias no canónicas en AggregatedLoadCurve fusionando colisiones de clave única
    const aggProvs = await prisma.aggregatedLoadCurve.groupBy({
      by: ['province'],
    });
    const canonicalSet = new Set(PROVINCE_NAMES);
    const dirtyProvinces = aggProvs
      .map((r) => r.province)
      .filter((p) => !canonicalSet.has(p));

    for (const dirtyProv of dirtyProvinces) {
      const targetProv = normalizeProvinceName(dirtyProv);
      const dirtyRows = await prisma.aggregatedLoadCurve.findMany({
        where: { province: dirtyProv },
      });

      if (dirtyRows.length === 0) continue;

      const dates = Array.from(new Set(dirtyRows.map((r) => r.date.toISOString())));
      const existingCanonRows = await prisma.aggregatedLoadCurve.findMany({
        where: {
          province: targetProv,
          date: { in: dates.map((iso) => new Date(iso)) },
        },
      });

      const canonByKey = new Map<string, (typeof existingCanonRows)[number]>();
      for (const cr of existingCanonRows) {
        const k = `${cr.date.toISOString().substring(0, 10)}|${cr.segment}|${cr.tariff}|${cr.companyId || 'null'}`;
        canonByKey.set(k, cr);
      }

      const idsToDelete: string[] = [];
      const idsToRenameOnly: string[] = [];

      for (const dr of dirtyRows) {
        const k = `${dr.date.toISOString().substring(0, 10)}|${dr.segment}|${dr.tariff}|${dr.companyId || 'null'}`;
        const collision = canonByKey.get(k);
        if (collision) {
          const mergedCons = new Array(24).fill(0);
          const hasSurplus =
            (collision.totalSurplus && collision.totalSurplus.length > 0) ||
            (dr.totalSurplus && dr.totalSurplus.length > 0);
          const mergedSurplus = hasSurplus ? new Array(24).fill(0) : [];
          for (let h = 0; h < 24; h++) {
            mergedCons[h] =
              Math.round(
                ((collision.totalConsumption[h] || 0) + (dr.totalConsumption[h] || 0)) * 1e6
              ) / 1e6;
            if (hasSurplus) {
              mergedSurplus[h] =
                Math.round(
                  ((collision.totalSurplus?.[h] || 0) + (dr.totalSurplus?.[h] || 0)) * 1e6
                ) / 1e6;
            }
          }
          await prisma.aggregatedLoadCurve.update({
            where: { id: collision.id },
            data: {
              totalConsumption: mergedCons,
              ...(hasSurplus ? { totalSurplus: mergedSurplus } : {}),
              clientCount: collision.clientCount + dr.clientCount,
            },
          });
          idsToDelete.push(dr.id);
          provincesNormalized++;
        } else {
          idsToRenameOnly.push(dr.id);
          provincesNormalized++;
        }
      }

      if (idsToDelete.length > 0) {
        await prisma.aggregatedLoadCurve.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }
      if (idsToRenameOnly.length > 0) {
        await prisma.aggregatedLoadCurve.updateMany({
          where: { id: { in: idsToRenameOnly } },
          data: { province: targetProv },
        });
      }
    }

    // 3. Sincronizar WeatherHistory para todo el rango histórico de AggregatedLoadCurve (y los últimos 365 días)
    const bounds = await prisma.aggregatedLoadCurve.aggregate({
      _min: { date: true },
      _max: { date: true },
    });
    const yesterdayYmd = addDaysYmd(toMadridYmd(new Date()), -1);
    const defaultStartYmd = addDaysYmd(yesterdayYmd, -365);
    const minAggYmd = bounds._min.date
      ? bounds._min.date.toISOString().substring(0, 10)
      : defaultStartYmd;
    const syncStartYmd = minAggYmd < defaultStartYmd ? minAggYmd : defaultStartYmd;

    const weatherSync = await WeatherSyncService.syncWeatherHistoryRange(
      syncStartYmd,
      yesterdayYmd,
      PROVINCE_NAMES
    );

    // 4. Inyectar temperaturas reales en bloque en todas las filas de AggregatedLoadCurve que tenían el fallback plano 20 °C
    const updatedCount = await prisma.$executeRaw`
      UPDATE "AggregatedLoadCurve" a
      SET "temperature" = w."temperatures",
          "updatedAt" = NOW()
      FROM "WeatherHistory" w
      WHERE a."date" = w."date"
        AND a."province" = w."province"
        AND a."temperature" IS DISTINCT FROM w."temperatures"
    `;

    return {
      provincesNormalized,
      weatherInserted: weatherSync.inserted,
      curvesWeatherUpdated: Number(updatedCount),
    };
  }
}
