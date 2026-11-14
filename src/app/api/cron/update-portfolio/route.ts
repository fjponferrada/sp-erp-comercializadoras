import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import {
  calculatePpaHourlyMwh,
  calculatePpaIntervalFinancials,
  getClockHourOccurrencesInMonth,
  getMadridPartsFromUtcMs,
  getPpaMadridBounds,
} from '@/lib/ppaEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOCAL_FALLBACK_CRON_TOKEN = 'SpEnergia2026_UltraCron';

async function authorizePortfolioSync(req: Request): Promise<{
  authorized: boolean;
  forbidden?: boolean;
  isCron: boolean;
  sessionCompanyId: string | null;
}> {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret');

  if (
    expectedSecret &&
    (authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret)
  ) {
    return { authorized: true, isCron: true, sessionCompanyId: null };
  }

  if (cronHeader === '1' && Boolean(process.env.VERCEL)) {
    return { authorized: true, isCron: true, sessionCompanyId: null };
  }

  // Soporte explícito para el Programador de Tareas local (scripts/trigger-cron.ps1) cuando CRON_SECRET no está definido en .env
  if (
    !expectedSecret &&
    (authHeader === `Bearer ${LOCAL_FALLBACK_CRON_TOKEN}` ||
      querySecret === LOCAL_FALLBACK_CRON_TOKEN)
  ) {
    return { authorized: true, isCron: true, sessionCompanyId: null };
  }

  const session = await auth();
  if (session?.user) {
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return { authorized: false, forbidden: true, isCron: false, sessionCompanyId: null };
    }
    const companyId = await resolveActiveCompanyId(session);
    return { authorized: true, isCron: false, sessionCompanyId: companyId };
  }

  return { authorized: false, isCron: false, sessionCompanyId: null };
}

async function runUpdatePortfolio(req: Request) {
  try {
    const authState = await authorizePortfolioSync(req);
    if (!authState.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authState.forbidden
            ? 'Permisos insuficientes para sincronizar el portfolio.'
            : 'No autorizado',
        },
        { status: authState.forbidden ? 403 : 401 }
      );
    }

    console.log('🚀 INICIANDO ORQUESTADOR FINANCIERO MULTI-EMPRESA (PARIDAD AED)...');

    const { searchParams } = new URL(req.url);
    const requestedCompanyId = searchParams.get('companyId') || authState.sessionCompanyId;

    const companies = requestedCompanyId
      ? await prisma.company.findMany({
          where: { id: requestedCompanyId },
          select: { id: true, name: true },
        })
      : await prisma.company.findMany({
          where: { empresaVisible: true },
          select: { id: true, name: true },
        });

    if (companies.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron comercializadoras activas para sincronizar.' },
        { status: 404 }
      );
    }

    const now = new Date();
    // Arrancar desde el día 1 del mes anterior y cubrir 1.250 días (~41 meses) para soportar renovaciones del mes en curso y ofertas de hasta 36 meses en hora local Europe/Madrid
    const horizonStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
    const daysToGenerate = 1250;
    const hoursToGenerate = daysToGenerate * 24;

    // Pre-calcular partes horarias en Europe/Madrid una sola vez para todo el horizonte
    const horizonDates = new Array<Date>(hoursToGenerate);
    const horizonMadrid = new Array<ReturnType<typeof getMadridPartsFromUtcMs>>(hoursToGenerate);
    const occCache = new Map<string, number[]>();

    const cursor = new Date(horizonStart.getTime());
    for (let i = 0; i < hoursToGenerate; i++) {
      const utcMs = cursor.getTime();
      horizonDates[i] = new Date(utcMs);
      const mp = getMadridPartsFromUtcMs(utcMs);
      horizonMadrid[i] = mp;
      const ymKey = `${mp.year}-${mp.month}`;
      if (!occCache.has(ymKey)) {
        occCache.set(ymKey, getClockHourOccurrencesInMonth(mp.year, mp.month));
      }
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }

    // MERCADO COMÚN: Futuros OMIE + Curvas horarias de pato desde histórico OMIE
    const futuros = await prisma.futurePrice.findMany();
    const futureMap = new Map<number, number>();
    let validFuturesSum = 0;
    let validFuturesCount = 0;
    let maxFutureYear = 0;

    for (const f of futuros) {
      if (f.price > 0) {
        futureMap.set(f.month, f.price);
        validFuturesSum += f.price;
        validFuturesCount++;
        const fYear = Math.floor(f.month / 100);
        if (fYear > maxFutureYear) maxFutureYear = fYear;
      }
    }
    const globalFallbackFuture = validFuturesCount > 0 ? validFuturesSum / validFuturesCount : 65.0;

    const resolveFuturePrice = (year: number, month: number): number => {
      const exact = futureMap.get(year * 100 + month);
      if (exact !== undefined && exact > 0) return exact;

      // Proyección estacional: buscar el mismo mes en el año cargado más reciente
      for (let y = Math.min(year - 1, maxFutureYear); y >= 2024; y--) {
        const prev = futureMap.get(y * 100 + month);
        if (prev !== undefined && prev > 0) return prev;
      }
      return globalFallbackFuture;
    };

    const lastYear = new Date(now);
    lastYear.setUTCFullYear(now.getUTCFullYear() - 1);

    const omieHistorical = await prisma.systemComponentPrice.findMany({
      where: {
        component: 'OMIE',
        date: { gte: lastYear },
      },
    });

    const monthDowCurveSum = new Map<string, number[]>();
    const monthDowCurveCount = new Map<string, number>();

    for (const record of omieHistorical) {
      const m = record.date.getUTCMonth() + 1;
      const w = record.date.getUTCDay();
      const key = `${m}-${w}`;

      if (!monthDowCurveSum.has(key)) {
        monthDowCurveSum.set(key, new Array(24).fill(0));
        monthDowCurveCount.set(key, 0);
      }

      const sums = monthDowCurveSum.get(key)!;
      const isQuarterly = record.values.length > 24;

      for (let h = 0; h < 24; h++) {
        let hourSum = 0;
        let c = 0;

        if (isQuarterly) {
          for (let q = 0; q < 4; q++) {
            if (record.values[h * 4 + q] !== undefined) {
              hourSum += record.values[h * 4 + q];
              c++;
            }
          }
        } else if (record.values[h] !== undefined) {
          hourSum += record.values[h];
          c++;
        }

        sums[h] += c > 0 ? hourSum / c : 0;
      }
      monthDowCurveCount.set(key, monthDowCurveCount.get(key)! + 1);
    }

    const normalizeCurve = (c: number[]) => {
      const sum = c.reduce((a, b) => a + b, 0);
      if (sum === 0) return c.map(() => 1.0);
      return c.map((v) => v * (24 / sum));
    };

    const dataDrivenCurves = new Map<string, number[]>();
    for (let m = 1; m <= 12; m++) {
      for (let w = 0; w <= 6; w++) {
        const key = `${m}-${w}`;
        if (monthDowCurveSum.has(key) && monthDowCurveCount.get(key)! > 0) {
          const avgCurve = monthDowCurveSum
            .get(key)!
            .map((s) => s / monthDowCurveCount.get(key)!);
          dataDrivenCurves.set(key, normalizeCurve(avgCurve));
        }
      }
    }

    const winterCurve = [0.8, 0.75, 0.75, 0.75, 0.8, 0.9, 1.1, 1.2, 1.2, 1.1, 1.0, 0.95, 0.95, 0.95, 0.95, 0.95, 1.0, 1.2, 1.3, 1.3, 1.2, 1.1, 0.9, 0.85];
    const springCurve = [0.9, 0.85, 0.8, 0.8, 0.85, 0.9, 1.0, 1.0, 0.8, 0.4, 0.1, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.8, 1.4, 2.2, 2.5, 2.1, 1.6, 1.1];
    const summerCurve = [1.0, 0.9, 0.9, 0.85, 0.85, 0.9, 0.95, 1.0, 0.9, 0.7, 0.5, 0.3, 0.3, 0.3, 0.3, 0.4, 0.6, 0.9, 1.3, 1.8, 2.2, 1.9, 1.5, 1.2];

    const normWinter = normalizeCurve(winterCurve);
    const normSpring = normalizeCurve(springCurve);
    const normSummer = normalizeCurve(summerCurve);

    // Pre-calcular serie horaria OMIE proyectada común
    const omieHourlyProjected = new Array<number>(hoursToGenerate);
    for (let i = 0; i < hoursToGenerate; i++) {
      const mp = horizonMadrid[i];
      const futurePrice = resolveFuturePrice(mp.year, mp.month);
      let selectedCurve = dataDrivenCurves.get(`${mp.month}-${mp.dow}`);
      if (!selectedCurve) {
        if ([1, 2, 11, 12].includes(mp.month)) selectedCurve = normWinter;
        else if ([3, 4, 5].includes(mp.month)) selectedCurve = normSpring;
        else selectedCurve = normSummer;
      }
      omieHourlyProjected[i] = futurePrice * selectedCurve[mp.hour];
    }

    const companyResults: Array<{
      companyId: string;
      companyName: string;
      activeContracts: number;
      demandaBcMwh: number;
      ppasIncluded: number;
    }> = [];

    for (const company of companies) {
      // 1. Cartera viva estrictamente filtrada por comercializadora
      const contracts = await prisma.contract.findMany({
        where: {
          brand: { companyId: company.id },
          status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active', 'EN_VIGOR'] },
        },
        include: {
          supplyPoint: { select: { tariff: true, annualConsumption: true } },
        },
      });

      let demanda_bc_mwh = 0;
      for (const c of contracts) {
        let consumption = c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? 0;
        if (consumption > 0) {
          const tariff = c.supplyPoint?.tariff || '';
          // Defensa ante consumos residuales guardados en kWh en contratos legacy (Regla 188)
          if (tariff.includes('2.0') && consumption > 500) {
            consumption = consumption / 1000;
          }
          const lossFactor =
            tariff.includes('6.1') ||
            tariff.includes('6.2') ||
            tariff.includes('6.3') ||
            tariff.includes('6.4')
              ? 1.07
              : 1.17;
          demanda_bc_mwh += consumption * lossFactor;
        }
      }

      // 2. Patrón horario histórico de la comercializadora (con fallback global si la empresa es nueva)
      let historicalCurves = await prisma.aggregatedLoadCurve.findMany({
        where: { companyId: company.id },
        orderBy: { date: 'desc' },
        take: 365,
      });

      if (historicalCurves.length === 0) {
        historicalCurves = await prisma.aggregatedLoadCurve.findMany({
          orderBy: { date: 'desc' },
          take: 365,
        });
      }

      if (historicalCurves.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'La base de datos histórica (AggregatedLoadCurve) está vacía. Debe poblarse antes de proyectar la demanda.',
          },
          { status: 400 }
        );
      }

      const patternMap = new Map<string, number>();
      const patternCount = new Map<string, number>();

      for (const curve of historicalCurves) {
        const m = curve.date.getUTCMonth() + 1;
        const dw = curve.date.getUTCDay();
        const isQuarterly = curve.totalConsumption.length >= 96;
        for (let h = 0; h < 24; h++) {
          const val = isQuarterly
            ? (curve.totalConsumption[h * 4] || 0) +
              (curve.totalConsumption[h * 4 + 1] || 0) +
              (curve.totalConsumption[h * 4 + 2] || 0) +
              (curve.totalConsumption[h * 4 + 3] || 0)
            : curve.totalConsumption[h] || 0;
          const key = `${m}-${dw}-${h}`;
          patternMap.set(key, (patternMap.get(key) || 0) + val);
          patternCount.set(key, (patternCount.get(key) || 0) + 1);
        }
      }

      for (const [key, sum] of patternMap.entries()) {
        patternMap.set(key, sum / patternCount.get(key)!);
      }

      let totalP = 0;
      let cP = 0;
      for (const v of patternMap.values()) {
        totalP += v;
        cP++;
      }
      const media_historica = cP > 0 ? totalP / cP : 1.0;

      const preCalculatedDemand = new Array<number>(hoursToGenerate);
      let sumPreDemand = 0;
      for (let i = 0; i < hoursToGenerate; i++) {
        const mp = horizonMadrid[i];
        const baseVal = patternMap.get(`${mp.month}-${mp.dow}-${mp.hour}`) ?? media_historica;
        preCalculatedDemand[i] = baseVal;
        sumPreDemand += baseVal;
      }

      const media_actual = sumPreDemand / hoursToGenerate;
      const media_objetivo = demanda_bc_mwh / 8760;
      const factor_escala = media_actual > 0 ? media_objetivo / media_actual : 1.0;

      // 3. PPAs incluidos en Pricing de esta comercializadora exclusivamente
      const ppas = await prisma.ppa.findMany({
        where: { companyId: company.id, includeInPricing: true },
      });

      const ppaWithBounds = ppas.map((p) => ({
        ppa: p,
        bounds: getPpaMadridBounds(p),
      }));

      const allRecords = new Array<{
        companyId: string;
        datetime: Date;
        basePriceEurMwh: number;
        omiePriceEurMwh: number;
        demandMwh: number;
        ppaMwh: number;
      }>(hoursToGenerate);

      for (let i = 0; i < hoursToGenerate; i++) {
        const mp = horizonMadrid[i];
        const precioOmieReal = omieHourlyProjected[i];
        const demandaHoraMwh = preCalculatedDemand[i] * factor_escala;
        const hourOccurrences = occCache.get(`${mp.year}-${mp.month}`)!;

        let ppaFisicoHoraMwh = 0;
        let costePpaFisicoEur = 0;
        let ppaFinancieroHoraMwh = 0;
        let costePpaFinancieroRefEur = 0;
        let liquidacionCfdEur = 0;

        for (const { ppa, bounds } of ppaWithBounds) {
          if (mp.ymd < bounds.startYmd) continue;
          if (bounds.endYmd && mp.ymd > bounds.endYmd) continue;

          const mwThisHour = calculatePpaHourlyMwh(
            ppa,
            mp.year,
            mp.month,
            mp.day,
            mp.hour,
            hourOccurrences
          );
          if (mwThisHour <= 0) continue;

          const fin = calculatePpaIntervalFinancials(
            ppa,
            mwThisHour,
            precioOmieReal,
            mp.year,
            mp.month,
            mp.day
          );

          if (ppa.type === 'FISICO') {
            // Solo los PPAs FÍSICOS entregan energía bilateralmente y reducen la compra física en OMIE
            ppaFisicoHoraMwh += mwThisHour;
            costePpaFisicoEur += mwThisHour * fin.unitContractPriceEurMwh;
          } else {
            // Los PPAs FINANCIEROS (CfD) NO reducen la compra física en OMIE: liquidan por diferencias
            ppaFinancieroHoraMwh += mwThisHour;
            costePpaFinancieroRefEur += mwThisHour * fin.unitContractPriceEurMwh;
            liquidacionCfdEur += fin.cfdOrMtmEur;
          }
        }

        const compraOmieMwh = Math.max(0, demandaHoraMwh - ppaFisicoHoraMwh);
        const ventaOmieMwh = Math.max(0, ppaFisicoHoraMwh - demandaHoraMwh);

        const costeCompraEur = compraOmieMwh * precioOmieReal;
        const ingresoVentaEur = ventaOmieMwh * precioOmieReal;
        const costeTotalNetoEur =
          costePpaFisicoEur + costeCompraEur - ingresoVentaEur - liquidacionCfdEur;

        const totalPpaPricingMwh = ppaFisicoHoraMwh + ppaFinancieroHoraMwh;
        let basePriceEurMwh = precioOmieReal;
        if (demandaHoraMwh > 0) {
          basePriceEurMwh = costeTotalNetoEur / demandaHoraMwh;
        } else if (totalPpaPricingMwh > 0) {
          basePriceEurMwh =
            (costePpaFisicoEur + costePpaFinancieroRefEur) / totalPpaPricingMwh;
        }

        allRecords[i] = {
          companyId: company.id,
          datetime: horizonDates[i],
          basePriceEurMwh,
          omiePriceEurMwh: precioOmieReal,
          demandMwh: demandaHoraMwh,
          ppaMwh: ppaFisicoHoraMwh,
        };
      }

      // 4. Reemplazo atómico en transacción para no dejar el cotizador vacío a mitad de proceso
      const batchSize = 5000;
      await prisma.$transaction(
        async (tx) => {
          await tx.portfolioBaseCurve.deleteMany({
            where: {
              OR: [{ companyId: company.id }, { companyId: null }],
            },
          });

          for (let offset = 0; offset < allRecords.length; offset += batchSize) {
            await tx.portfolioBaseCurve.createMany({
              data: allRecords.slice(offset, offset + batchSize),
              skipDuplicates: true,
            });
          }
        },
        { maxWait: 15000, timeout: 60000 }
      );

      companyResults.push({
        companyId: company.id,
        companyName: company.name,
        activeContracts: contracts.length,
        demandaBcMwh: Number(demanda_bc_mwh.toFixed(2)),
        ppasIncluded: ppas.length,
      });

      console.log(
        `✅ [${company.name}] Portfolio sincronizado (${contracts.length} contratos · ${demanda_bc_mwh.toFixed(2)} MWh BC · ${ppas.length} PPAs en pricing)`
      );
    }

    const primary = companyResults[0];
    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      message: `Portfolio sincronizado (${daysToGenerate} días / ${hoursToGenerate} h · Cartera activa: ${primary.demandaBcMwh.toFixed(0)} MWh · PPAs en pricing: ${primary.ppasIncluded}).`,
      stats: {
        hoursGenerated: hoursToGenerate,
        activeContracts: primary.activeContracts,
        demandaBcMwh: primary.demandaBcMwh,
        ppasIncluded: primary.ppasIncluded,
        maxFutureYearLoaded: maxFutureYear,
        companiesSynced: companyResults,
      },
    });
  } catch (error: any) {
    console.error('Error en Orquestador:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return runUpdatePortfolio(req);
}

export async function POST(req: Request) {
  return runUpdatePortfolio(req);
}
