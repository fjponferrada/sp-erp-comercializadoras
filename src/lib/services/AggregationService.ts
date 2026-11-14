import { prisma } from '../prisma';
import { calculateSegment } from './SegmentService';
import { normalizeProvinceName } from './ProvinceService';
import { WeatherSyncService } from './WeatherSyncService';

type ContractInfo = { status: string; activationDate: Date | null; terminationDate: Date | null };
type CupsInfoMap = Record<
  string,
  { segment: string; province: string; tariff: string; companyId: string | null; contracts: ContractInfo[] }
>;

function toUtcMidnight(d: Date | string): Date {
  const iso = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function addUtcDays(d: Date, delta: number): Date {
  return new Date(d.getTime() + delta * 86_400_000);
}

function accumulateHourlyReadings(target24: number[], readings: number[], resolution: string) {
  if (resolution === 'QUARTER_HOURLY' || readings.length >= 96) {
    for (let i = 0; i < readings.length; i++) {
      const h = Math.floor(i / 4);
      if (h < 24) {
        target24[h] += readings[i] || 0;
      }
    }
  } else {
    for (let i = 0; i < Math.min(24, readings.length); i++) {
      target24[i] += readings[i] || 0;
    }
  }
}

const EXCLUDED_CONTRACT_STATUS_REGEX = /rechaz|borrador|draft|anulad|cancel|tramit|solicitud/i;

export class AggregationService {
  private static async loadCupsInfoMap(targetCompanyId?: string): Promise<CupsInfoMap> {
    const spWhere: any = {};
    if (targetCompanyId) {
      spWhere.OR = [
        { client: { brand: { companyId: targetCompanyId } } },
        { contracts: { some: { brand: { companyId: targetCompanyId } } } },
      ];
    }

    const sps = await prisma.supplyPoint.findMany({
      where: spWhere,
      select: {
        cups: true,
        segment: true,
        province: true,
        postalCode: true,
        tariff: true,
        annualConsumption: true,
        p1c: true,
        cnae: true,
        client: {
          select: {
            brand: {
              select: {
                companyId: true,
              },
            },
          },
        },
        contracts: {
          select: {
            status: true,
            activationDate: true,
            terminationDate: true,
            brand: {
              select: {
                companyId: true,
              },
            },
          },
        },
      },
    });

    const cupsInfo: CupsInfoMap = {};
    for (const sp of sps) {
      const calculatedSegment = sp.segment || calculateSegment(sp.tariff, sp.annualConsumption, sp.p1c, sp.cnae);
      const baseCups = sp.cups.substring(0, 20);
      const canonicalProv = normalizeProvinceName(sp.province, sp.postalCode);
      const resolvedCompanyId =
        sp.client?.brand?.companyId ||
        sp.contracts.find((c) => c.brand?.companyId)?.brand?.companyId ||
        null;

      if (!cupsInfo[baseCups]) {
        cupsInfo[baseCups] = {
          segment: calculatedSegment,
          province: canonicalProv,
          tariff: sp.tariff || '2.0TD',
          companyId: resolvedCompanyId,
          contracts: [],
        };
      }
      cupsInfo[baseCups].contracts.push(...sp.contracts);
    }

    return cupsInfo;
  }

  private static isContractActiveOnUtcDay(contracts: ContractInfo[], dayUtc: Date): boolean {
    if (contracts.length === 0) return false;
    for (const c of contracts) {
      if (!c.activationDate) continue;
      if (c.status && EXCLUDED_CONTRACT_STATUS_REGEX.test(c.status)) continue;
      const start = toUtcMidnight(c.activationDate);
      const end = c.terminationDate ? toUtcMidnight(c.terminationDate) : null;
      if (dayUtc >= start && (!end || dayUtc <= end)) {
        return true;
      }
    }
    return false;
  }

  private static async processDateChunk(
    chunkDates: Date[],
    cupsInfo: CupsInfoMap,
    targetCompanyId?: string
  ): Promise<number> {
    if (chunkDates.length === 0) return 0;

    const deleteWhere: any = { date: { in: chunkDates } };
    if (targetCompanyId) {
      deleteWhere.companyId = targetCompanyId;
    }
    await prisma.aggregatedLoadCurve.deleteMany({ where: deleteWhere });

    const [curves, weathers] = await Promise.all([
      prisma.loadCurve.findMany({
        where: {
          date: { in: chunkDates },
          type: { in: ['CONSUMPTION', 'SURPLUS'] },
        },
      }),
      prisma.weatherHistory.findMany({
        where: { date: { in: chunkDates } },
      }),
    ]);

    if (curves.length === 0) return 0;

    const tempByDateProv = new Map<string, number[]>();
    for (const w of weathers) {
      const dStr = w.date.toISOString().slice(0, 10);
      tempByDateProv.set(`${dStr}|${w.province}`, w.temperatures);
    }

    const agg = new Map<
      string,
      {
        date: Date;
        companyId: string | null;
        segment: string;
        province: string;
        tariff: string;
        sumConsumption: number[];
        sumSurplus: number[];
        cupsSet: Set<string>;
      }
    >();

    for (const curve of curves) {
      const baseCups = curve.cups.substring(0, 20);
      const info = cupsInfo[baseCups];
      if (!info) continue;

      const dayUtc = toUtcMidnight(curve.date);
      if (!this.isContractActiveOnUtcDay(info.contracts, dayUtc)) continue;

      const dStr = dayUtc.toISOString().slice(0, 10);
      const key = `${dStr}|${info.companyId || 'null'}|${info.segment}|${info.province}|${info.tariff}`;
      let entry = agg.get(key);
      if (!entry) {
        entry = {
          date: dayUtc,
          companyId: info.companyId,
          segment: info.segment,
          province: info.province,
          tariff: info.tariff,
          sumConsumption: new Array(24).fill(0),
          sumSurplus: new Array(24).fill(0),
          cupsSet: new Set<string>(),
        };
        agg.set(key, entry);
      }

      if (curve.type === 'SURPLUS') {
        accumulateHourlyReadings(entry.sumSurplus, curve.readings, curve.resolution);
      } else {
        accumulateHourlyReadings(entry.sumConsumption, curve.readings, curve.resolution);
        entry.cupsSet.add(baseCups);
      }
    }

    const inserts: any[] = [];
    for (const entry of agg.values()) {
      if (entry.cupsSet.size === 0 && entry.sumSurplus.every(v => v === 0)) continue;
      const dStr = entry.date.toISOString().slice(0, 10);
      const temp = tempByDateProv.get(`${dStr}|${entry.province}`) || new Array(24).fill(20.0);

      inserts.push({
        date: entry.date,
        segment: entry.segment,
        province: entry.province,
        tariff: entry.tariff,
        totalConsumption: entry.sumConsumption,
        totalSurplus: entry.sumSurplus,
        clientCount: entry.cupsSet.size,
        temperature: temp,
        companyId: entry.companyId,
      });
    }

    if (inserts.length > 0) {
      await prisma.aggregatedLoadCurve.createMany({
        data: inserts,
        skipDuplicates: true,
      });
    }

    return inserts.length;
  }

  /**
   * Regenera la tabla AggregatedLoadCurve para los últimos X días en bloques optimizados.
   */
  static async regenerateAggregates(
    days: number = 60,
    targetCompanyId?: string,
    onProgress?: (msg: string) => void
  ): Promise<number> {
    console.log(
      `Iniciando regeneración de AggregatedLoadCurve para los últimos ${days} días (Compañía: ${targetCompanyId || 'TODAS'})...`
    );
    if (onProgress) onProgress(`Cargando contratos y puntos de suministro...`);

    const cupsInfo = await this.loadCupsInfoMap(targetCompanyId);
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
    const todayUtc = toUtcMidnight(todayStr);
    const startUtc = addUtcDays(todayUtc, -days);
    const startStr = startUtc.toISOString().slice(0, 10);

    const uniqueProvinces = Array.from(
      new Set(Object.values(cupsInfo).map((info) => info.province))
    );
    if (uniqueProvinces.length > 0) {
      try {
        if (onProgress) onProgress(`Sincronizando temperaturas históricas Open-Meteo...`);
        await WeatherSyncService.syncWeatherHistoryRange(startStr, todayStr, uniqueProvinces);
      } catch (err) {
        console.error('[AggregationService] Aviso: fallo no bloqueante al sincronizar WeatherHistory:', err);
      }
    }

    const allDates: Date[] = [];
    for (let cur = startUtc; cur <= todayUtc; cur = addUtcDays(cur, 1)) {
      allDates.push(cur);
    }

    const CHUNK_DAYS = 10;
    let totalInsertados = 0;

    for (let i = 0; i < allDates.length; i += CHUNK_DAYS) {
      const chunk = allDates.slice(i, i + CHUNK_DAYS);
      const fromStr = chunk[0].toISOString().slice(0, 10);
      const toStr = chunk[chunk.length - 1].toISOString().slice(0, 10);
      if (onProgress) {
        onProgress(`Agregando curvas CCH (${fromStr} → ${toStr})...`);
      }
      totalInsertados += await this.processDateChunk(chunk, cupsInfo, targetCompanyId);
    }

    console.log(`¡Regeneración completada! Total agrupaciones insertadas: ${totalInsertados}`);
    return totalInsertados;
  }

  /**
   * Regenera AggregatedLoadCurve únicamente para las fechas exactas modificadas (ej. tras importar ficheros CCH históricos).
   */
  static async regenerateForDates(isoDates: string[], targetCompanyId?: string): Promise<number> {
    const uniqueSorted = Array.from(
      new Set(isoDates.map(d => d.slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))
    ).sort();

    if (uniqueSorted.length === 0) return 0;

    const cupsInfo = await this.loadCupsInfoMap(targetCompanyId);
    const uniqueProvinces = Array.from(
      new Set(Object.values(cupsInfo).map((info) => info.province))
    );
    if (uniqueProvinces.length > 0) {
      try {
        await WeatherSyncService.syncWeatherHistoryRange(
          uniqueSorted[0],
          uniqueSorted[uniqueSorted.length - 1],
          uniqueProvinces
        );
      } catch (err) {
        console.error('[AggregationService] Aviso: fallo no bloqueante al sincronizar WeatherHistory:', err);
      }
    }

    const allDates = uniqueSorted.map(d => toUtcMidnight(d));

    const CHUNK_DAYS = 15;
    let totalInsertados = 0;
    for (let i = 0; i < allDates.length; i += CHUNK_DAYS) {
      const chunk = allDates.slice(i, i + CHUNK_DAYS);
      totalInsertados += await this.processDateChunk(chunk, cupsInfo, targetCompanyId);
    }

    return totalInsertados;
  }
}
