import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';
import {
  calculatePpaHourlyMwh,
  calculatePpaIntervalFinancials,
  getClockHourOccurrencesInMonth,
  getContractYearIndex,
  getPpaMadridBounds,
  mapOmieIntervalToMadridClock,
} from '@/lib/ppaEngine';

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

    const { ppaId, startDate, endDate } = await request.json();

    if (!ppaId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({ error: 'Formato de fecha inválido (se esperaba YYYY-MM-DD)' }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'La fecha Hasta no puede ser anterior a la fecha Desde.' },
        { status: 400 }
      );
    }

    const ppa = await prisma.ppa.findUnique({
      where: { id: ppaId },
    });

    if (!ppa || ppa.companyId !== companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o sin acceso' }, { status: 404 });
    }

    const bounds = getPpaMadridBounds(ppa);
    const effectiveStartYmd = startDate > bounds.startYmd ? startDate : bounds.startYmd;
    const effectiveEndYmd = bounds.endYmd && endDate > bounds.endYmd ? bounds.endYmd : endDate;

    if (effectiveStartYmd > effectiveEndYmd) {
      return NextResponse.json(
        {
          error: `El periodo seleccionado (${startDate} a ${endDate}) está fuera de la vigencia contractual de este PPA (${bounds.startYmd} a ${bounds.endYmd || 'Indefinido'}).`,
        },
        { status: 400 }
      );
    }

    const wasClippedToValidity =
      effectiveStartYmd !== startDate || effectiveEndYmd !== endDate;

    // @db.Date en PostgreSQL se consulta con medianoche UTC exacta sin desviación de huso del servidor
    const startUtc = new Date(`${effectiveStartYmd}T00:00:00.000Z`);
    const endUtc = new Date(`${effectiveEndYmd}T00:00:00.000Z`);

    const omiePrices = await prisma.systemComponentPrice.findMany({
      where: {
        component: 'OMIE',
        date: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      orderBy: { date: 'asc' },
    });

    if (omiePrices.length === 0) {
      return NextResponse.json(
        {
          error: `No hay precios reales de OMIE cargados para el periodo ${effectiveStartYmd} a ${effectiveEndYmd}.`,
        },
        { status: 404 }
      );
    }

    const isFijo = ppa.priceType === 'FIJO';
    const isFinanciero = ppa.type === 'FINANCIERO';

    let totalMwh = 0;
    let totalEur = 0;
    let totalCfdOrMtmEur = 0;
    let totalPhysicalInvoiceEur = 0;
    let omieMedioPpaNumerator = 0;
    let contractPriceNumerator = 0;

    const detailedRows: Array<{
      datetime: string;
      omie: number;
      mwh: number;
      contractPrice: number;
      appliedPrice: number;
      liquidacionEur: number;
      mtmEur: number;
    }> = [];

    const dailySummary: Array<{
      date: string;
      intervals: number;
      mwh: number;
      omieAvg: number;
      contractPriceAvg: number;
      liquidacionEur: number;
      mtmEur: number;
    }> = [];

    const occCache = new Map<string, number[]>();

    for (const dailyData of omiePrices) {
      const dateStr = dailyData.date.toISOString().split('T')[0];
      const [year, month1to12, day] = dateStr.split('-').map(Number);

      const ymKey = `${year}-${month1to12}`;
      let hourOccurrences = occCache.get(ymKey);
      if (!hourOccurrences) {
        hourOccurrences = getClockHourOccurrencesInMonth(year, month1to12);
        occCache.set(ymKey, hourOccurrences);
      }

      const values = dailyData.values;
      let dayMwh = 0;
      let dayOmieNum = 0;
      let dayContractNum = 0;
      let dayPrimaryEur = 0;
      let dayMtmEur = 0;

      for (let i = 0; i < values.length; i++) {
        const omiePrice = values[i];
        const mapped = mapOmieIntervalToMadridClock(i, values.length);

        const hourlyMwh = calculatePpaHourlyMwh(
          ppa,
          year,
          month1to12,
          day,
          mapped.clockHour,
          hourOccurrences
        );
        const mwhInterval = mapped.isQuarterly ? hourlyMwh / 4 : hourlyMwh;

        const fin = calculatePpaIntervalFinancials(
          ppa,
          mwhInterval,
          omiePrice,
          year,
          month1to12,
          day
        );

        totalMwh += mwhInterval;
        totalEur += fin.primarySettlementEur;
        totalCfdOrMtmEur += fin.cfdOrMtmEur;
        totalPhysicalInvoiceEur += fin.physicalInvoiceCostEur;
        omieMedioPpaNumerator += omiePrice * mwhInterval;
        contractPriceNumerator += fin.unitContractPriceEurMwh * mwhInterval;

        dayMwh += mwhInterval;
        dayOmieNum += omiePrice * mwhInterval;
        dayContractNum += fin.unitContractPriceEurMwh * mwhInterval;
        dayPrimaryEur += fin.primarySettlementEur;
        dayMtmEur += fin.cfdOrMtmEur;

        detailedRows.push({
          datetime: `${dateStr} ${mapped.labelHm}`,
          omie: omiePrice,
          mwh: mwhInterval,
          contractPrice: fin.unitContractPriceEurMwh,
          appliedPrice: fin.primaryAppliedUnitEurMwh,
          liquidacionEur: fin.primarySettlementEur,
          mtmEur: fin.cfdOrMtmEur,
        });
      }

      dailySummary.push({
        date: dateStr,
        intervals: values.length,
        mwh: dayMwh,
        omieAvg: dayMwh > 0 ? dayOmieNum / dayMwh : 0,
        contractPriceAvg: dayMwh > 0 ? dayContractNum / dayMwh : 0,
        liquidacionEur: dayPrimaryEur,
        mtmEur: dayMtmEur,
      });
    }

    const expectedDays =
      Math.round((endUtc.getTime() - startUtc.getTime()) / 86400000) + 1;
    const calculatedDays = omiePrices.length;
    const missingDays = Math.max(0, expectedDays - calculatedDays);

    const omieMedioPpa = totalMwh > 0 ? omieMedioPpaNumerator / totalMwh : 0;
    const effectiveContractPriceAvg = totalMwh > 0 ? contractPriceNumerator / totalMwh : 0;
    const contractYearNumber = getContractYearIndex(bounds.startYmd, effectiveStartYmd) + 1;

    return NextResponse.json({
      summary: {
        ppaName: ppa.name,
        ppaType: ppa.type,
        ppaSubtype: ppa.subtype,
        priceType: ppa.priceType,
        isFijo,
        isFinanciero,
        settlementMode: isFinanciero ? 'CFD' : 'FACTURA_FISICA',
        totalMwh,
        totalEur,
        totalCfdOrMtmEur,
        totalPhysicalInvoiceEur,
        omieMedioPpa,
        effectiveContractPriceAvg,
        annualDegradationPct: ppa.annualDegradationPct ?? 0,
        annualEscalationPct: ppa.annualEscalationPct ?? 0,
        contractYearNumber,
        calculatedDays,
        expectedDays,
        missingDays,
        wasClippedToValidity,
        effectiveStartDate: effectiveStartYmd,
        effectiveEndDate: effectiveEndYmd,
      },
      daily: dailySummary,
      details: detailedRows,
    });
  } catch (error: any) {
    console.error('Error calculando liquidación PPA:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
