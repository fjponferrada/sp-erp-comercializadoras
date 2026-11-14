import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';
import {
  calculatePpaHourlyMwh,
  calculatePpaIntervalFinancials,
  getClockHourOccurrencesInMonth,
  getMadridPartsFromUtcMs,
  getPpaMadridBounds,
  parseMadridStartOfDay,
} from '@/lib/ppaEngine';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split('T')[0];
}

function getEndOfRolling12MonthsYmd(baseYear: number, baseMonth1to12: number): string {
  // 12 meses completos desde el mes base inclusive
  const endUtc = new Date(Date.UTC(baseYear, baseMonth1to12 - 1 + 12, 0));
  return endUtc.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa activa no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { ppaId, discountRatePct: rawDiscount } = body;
    const discountRatePct =
      rawDiscount !== undefined && rawDiscount !== null && Number.isFinite(Number(rawDiscount))
        ? Math.max(0, Math.min(30, Number(rawDiscount)))
        : 3.5;

    if (!ppaId) {
      return NextResponse.json({ error: 'Falta ppaId' }, { status: 400 });
    }

    const ppa = await prisma.ppa.findUnique({
      where: { id: ppaId },
    });

    if (!ppa || ppa.companyId !== companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o sin acceso' }, { status: 404 });
    }

    const nowMs = Date.now();
    const nowMadrid = getMadridPartsFromUtcMs(nowMs);
    const bounds = getPpaMadridBounds(ppa);

    // Determinar inicio del horizonte futuro (día siguiente al último OMIE real si cae en el mes actual o posterior)
    let startYmd = `${nowMadrid.year}-${String(nowMadrid.month).padStart(2, '0')}-01`;

    const lastOmie = await prisma.systemComponentPrice.findFirst({
      where: { component: 'OMIE' },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (lastOmie?.date) {
      const lastOmieYmd = lastOmie.date.toISOString().split('T')[0];
      const nextAfterOmieYmd = addDaysYmd(lastOmieYmd, 1);
      if (nextAfterOmieYmd > startYmd) {
        startYmd = nextAfterOmieYmd;
      }
    }

    // Si el contrato ya venció antes del horizonte futuro, devolver estado vencido limpio
    if (bounds.endYmd && bounds.endYmd < startYmd) {
      return NextResponse.json({
        success: true,
        expired: true,
        message: `El contrato PPA finalizó el ${bounds.endYmd} y no tiene exposición futura pendiente.`,
        projection: [],
        mtmSummary: null,
      });
    }

    const rolling12EndYmd = getEndOfRolling12MonthsYmd(nowMadrid.year, nowMadrid.month);
    const queryStart = parseMadridStartOfDay(startYmd > bounds.startYmd ? startYmd : bounds.startYmd);

    // Consultamos todo el horizonte disponible en PortfolioBaseCurve para (a) tabla 12M y (b) MtM total disponible
    let futureData = await prisma.portfolioBaseCurve.findMany({
      where: {
        companyId,
        datetime: { gte: queryStart },
      },
      orderBy: { datetime: 'asc' },
      select: {
        datetime: true,
        omiePriceEurMwh: true,
        updatedAt: true,
      },
    });

    // Fallback por si existen registros previos sin companyId
    if (futureData.length === 0) {
      futureData = await prisma.portfolioBaseCurve.findMany({
        where: {
          companyId: null,
          datetime: { gte: queryStart },
        },
        orderBy: { datetime: 'asc' },
        select: {
          datetime: true,
          omiePriceEurMwh: true,
          updatedAt: true,
        },
      });
    }

    if (futureData.length === 0) {
      return NextResponse.json(
        {
          error:
            'No hay datos en la Curva Base del Portfolio para proyectar este PPA. Pulsa "Sincronizar Portfolio Ahora" para generarla.',
        },
        { status: 404 }
      );
    }

    const isFijo = ppa.priceType === 'FIJO';
    const isFinanciero = ppa.type === 'FINANCIERO';
    const occCache = new Map<string, number[]>();

    const monthlySummary: Record<
      string,
      {
        monthKey: string;
        monthStr: string;
        totalMwh: number;
        totalEur: number;
        mtmEur: number;
        physicalCostEur: number;
        omieNumerator: number;
        contractPriceNumerator: number;
        hours: number;
      }
    > = {};

    let mtmTotalMwh = 0;
    let mtmUndiscountedEur = 0;
    let mtmDiscountedEur = 0;
    let mtmOmieNum = 0;
    let mtmContractNum = 0;
    let mtmMaxYmd = '';

    for (const record of futureData) {
      const utcMs = record.datetime.getTime();
      const mp = getMadridPartsFromUtcMs(utcMs);

      if (mp.ymd < bounds.startYmd) continue;
      if (bounds.endYmd && mp.ymd > bounds.endYmd) break;

      const ymKey = `${mp.year}-${String(mp.month).padStart(2, '0')}`;
      let hourOccurrences = occCache.get(ymKey);
      if (!hourOccurrences) {
        hourOccurrences = getClockHourOccurrencesInMonth(mp.year, mp.month);
        occCache.set(ymKey, hourOccurrences);
      }

      const mwh = calculatePpaHourlyMwh(
        ppa,
        mp.year,
        mp.month,
        mp.day,
        mp.hour,
        hourOccurrences
      );

      const fin = calculatePpaIntervalFinancials(
        ppa,
        mwh,
        record.omiePriceEurMwh,
        mp.year,
        mp.month,
        mp.day
      );

      // 1. Acumular Exposición Mark-to-Market (MtM) en todo el horizonte disponible de la curva
      const yearsFromNow = Math.max(0, (utcMs - nowMs) / (365.25 * 86400000));
      const df = 1 / Math.pow(1 + discountRatePct / 100, yearsFromNow);

      mtmTotalMwh += mwh;
      mtmUndiscountedEur += fin.cfdOrMtmEur;
      mtmDiscountedEur += fin.cfdOrMtmEur * df;
      mtmOmieNum += record.omiePriceEurMwh * mwh;
      mtmContractNum += fin.unitContractPriceEurMwh * mwh;
      mtmMaxYmd = mp.ymd;

      // 2. Acumular tabla mensual de los próximos 12 meses
      if (mp.ymd <= rolling12EndYmd) {
        if (!monthlySummary[ymKey]) {
          monthlySummary[ymKey] = {
            monthKey: ymKey,
            monthStr: `${MONTH_NAMES[mp.month - 1]} ${mp.year}`,
            totalMwh: 0,
            totalEur: 0,
            mtmEur: 0,
            physicalCostEur: 0,
            omieNumerator: 0,
            contractPriceNumerator: 0,
            hours: 0,
          };
        }

        const bucket = monthlySummary[ymKey];
        bucket.totalMwh += mwh;
        bucket.totalEur += fin.primarySettlementEur;
        bucket.mtmEur += fin.cfdOrMtmEur;
        bucket.physicalCostEur += fin.physicalInvoiceCostEur;
        bucket.omieNumerator += record.omiePriceEurMwh * mwh;
        bucket.contractPriceNumerator += fin.unitContractPriceEurMwh * mwh;
        bucket.hours += 1;
      }
    }

    const results = Object.keys(monthlySummary)
      .sort()
      .map((key) => {
        const data = monthlySummary[key];
        const omieMedio = data.totalMwh > 0 ? data.omieNumerator / data.totalMwh : 0;
        const contractPriceAvg =
          data.totalMwh > 0 ? data.contractPriceNumerator / data.totalMwh : 0;
        return {
          monthKey: key,
          monthStr: data.monthStr,
          totalMwh: data.totalMwh,
          totalEur: data.totalEur,
          mtmEur: data.mtmEur,
          physicalCostEur: data.physicalCostEur,
          omieMedio,
          contractPriceAvg,
          hours: data.hours,
          isFijo,
          isFinanciero,
        };
      });

    return NextResponse.json({
      success: true,
      expired: false,
      settlementMode: isFinanciero ? 'CFD' : 'FACTURA_FISICA',
      lastCurveUpdatedAt: futureData[0]?.updatedAt ?? null,
      projection: results,
      mtmSummary: {
        discountRatePct,
        horizonStartYmd: startYmd > bounds.startYmd ? startYmd : bounds.startYmd,
        horizonEndYmd: mtmMaxYmd || rolling12EndYmd,
        contractEndYmd: bounds.endYmd,
        totalMwh: mtmTotalMwh,
        undiscountedMtmEur: mtmUndiscountedEur,
        discountedMtmEur: mtmDiscountedEur,
        avgCapturedOmieEurMwh: mtmTotalMwh > 0 ? mtmOmieNum / mtmTotalMwh : 0,
        avgContractPriceEurMwh: mtmTotalMwh > 0 ? mtmContractNum / mtmTotalMwh : 0,
      },
    });
  } catch (error: any) {
    console.error('Error calculando proyección PPA:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
