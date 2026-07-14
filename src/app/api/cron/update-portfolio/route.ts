import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from 'date-fns';

export async function POST() {
  try {
    console.log('🚀 INICIANDO ORQUESTADOR FINANCIERO (PARIDAD AED)...');

    const start = new Date();
    // Generar a 800 días vista
    const daysToGenerate = 800;
    const hoursToGenerate = daysToGenerate * 24;

    // 1. OBTENER VOLUMEN DE CARTERA VIVA (Contratos Activos)
    const contracts = await prisma.contract.findMany({
      where: {
        OR: [
          { status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
          { 
            activationDate: { lte: start },
            OR: [
              { terminationDate: null },
              { terminationDate: { gte: start } }
            ]
          }
        ]
      },
      include: {
        supplyPoint: { select: { tariff: true, annualConsumption: true } }
      }
    });

    let demanda_bc_mwh = 0;
    for (const c of contracts) {
      const consumption = c.annualConsumption || c.supplyPoint?.annualConsumption;
      if (consumption) {
        const tariff = c.supplyPoint?.tariff || '';
        const lossFactor = (tariff.includes('6.1TD') || tariff.includes('6.2TD')) ? 1.10 : 1.17;
        demanda_bc_mwh += (consumption * lossFactor);
      }
    }
    
    if (demanda_bc_mwh === 0) {
      console.log('⚠️ CARTERA VACÍA. El volumen de la comercializadora será 0.0 MWh.');
    } else {
      console.log(`✅ Cartera viva proyectada: ${demanda_bc_mwh.toFixed(2)} MWh en Barras de Central.`);
    }

    // 2. CREAR EL PATRÓN DE CONSUMO DESDE HISTÓRICO
    const historicalCurves = await prisma.aggregatedLoadCurve.findMany({
      orderBy: { date: 'desc' },
      take: 365
    });

    const patternMap = new Map<string, number>(); 
    const patternCount = new Map<string, number>();

    if (historicalCurves.length > 0) {
      console.log(`📊 Generando patrón histórico basado en ${historicalCurves.length} días de AggregatedLoadCurve...`);
      for (const curve of historicalCurves) {
        const m = curve.date.getUTCMonth() + 1;
        const dw = curve.date.getUTCDay(); // 0 = Domingo
        for (let h = 0; h < 24; h++) {
          const val = curve.totalConsumption[h] || 0;
          const key = `${m}-${dw}-${h}`;
          patternMap.set(key, (patternMap.get(key) || 0) + val);
          patternCount.set(key, (patternCount.get(key) || 0) + 1);
        }
      }
      
      for (const [key, sum] of patternMap.entries()) {
        patternMap.set(key, sum / patternCount.get(key)!);
      }
    } else {
      console.log(`❌ ERROR: Tabla AggregatedLoadCurve vacía. Imposible modelar el patrón de demanda.`);
      return NextResponse.json({ success: false, error: "La base de datos histórica (AggregatedLoadCurve) está vacía. Debe poblarse antes de proyectar la demanda." }, { status: 400 });
    }

    let totalP = 0, cP = 0;
    for (const v of patternMap.values()) { totalP += v; cP++; }
    const media_historica = cP > 0 ? totalP / cP : 1.0;

    // 3. GENERAR HORIZONTE 800 DÍAS Y ESCALADO
    console.log(`📅 Generando curva escalada de ${hoursToGenerate} horas...`);
    const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0));
    
    const preCalculatedDemand = [];
    let sumPreDemand = 0;
    for (let i = 0; i < hoursToGenerate; i++) {
      const m = dt.getUTCMonth() + 1;
      const dw = dt.getUTCDay();
      const h = dt.getUTCHours();
      const key = `${m}-${dw}-${h}`;
      
      let baseVal = patternMap.get(key);
      if (baseVal === undefined) baseVal = media_historica;
      
      preCalculatedDemand.push(baseVal);
      sumPreDemand += baseVal;
      dt.setUTCHours(dt.getUTCHours() + 1);
    }
    
    const media_actual = sumPreDemand / hoursToGenerate;
    // La media_objetivo es el consumo anual dividido por 8760 horas
    const media_objetivo = demanda_bc_mwh / 8760;
    const factor_escala = media_actual > 0 ? media_objetivo / media_actual : 1.0;

    // 4. OBTENER MERCADO Y PPAS
    const futuros = await prisma.futurePrice.findMany();
    const futureMap = new Map<number, number>();
    for (const f of futuros) futureMap.set(f.month, f.price);

    const ppas = await prisma.ppa.findMany({ where: { includeInPricing: true } });

    // 4.1 CONSTRUIR CURVA DE PATO DESDE HISTÓRICO OMIE
    console.log('📈 Construyendo curvas de precio horario base desde histórico OMIE...');
    const lastYear = new Date(start);
    lastYear.setFullYear(start.getFullYear() - 1);
    
    const omieHistorical = await prisma.systemComponentPrice.findMany({
      where: {
        component: 'OMIE',
        date: { gte: lastYear }
      }
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
            if (record.values[h*4 + q] !== undefined) {
               hourSum += record.values[h*4 + q];
               c++;
            }
          }
        } else {
          if (record.values[h] !== undefined) {
             hourSum += record.values[h];
             c++;
          }
        }
        
        sums[h] += (c > 0 ? hourSum / c : 0);
      }
      monthDowCurveCount.set(key, monthDowCurveCount.get(key)! + 1);
    }

    const normalizeCurve = (c: number[]) => {
      const sum = c.reduce((a,b) => a+b, 0);
      if (sum === 0) return c.map(() => 1.0);
      return c.map(v => v * (24 / sum));
    };

    const dataDrivenCurves = new Map<string, number[]>();
    for (let m = 1; m <= 12; m++) {
      for (let w = 0; w <= 6; w++) {
        const key = `${m}-${w}`;
        if (monthDowCurveSum.has(key) && monthDowCurveCount.get(key)! > 0) {
          const avgCurve = monthDowCurveSum.get(key)!.map(s => s / monthDowCurveCount.get(key)!);
          dataDrivenCurves.set(key, normalizeCurve(avgCurve));
        }
      }
    }

    // Curvas sintéticas de pato (fallback)
    const winterCurve = [0.8, 0.75, 0.75, 0.75, 0.8, 0.9, 1.1, 1.2, 1.2, 1.1, 1.0, 0.95, 0.95, 0.95, 0.95, 0.95, 1.0, 1.2, 1.3, 1.3, 1.2, 1.1, 0.9, 0.85];
    const springCurve = [0.9, 0.85, 0.8, 0.8, 0.85, 0.9, 1.0, 1.0, 0.8, 0.4, 0.1, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.8, 1.4, 2.2, 2.5, 2.1, 1.6, 1.1];
    const summerCurve = [1.0, 0.9, 0.9, 0.85, 0.85, 0.9, 0.95, 1.0, 0.9, 0.7, 0.5, 0.3, 0.3, 0.3, 0.3, 0.4, 0.6, 0.9, 1.3, 1.8, 2.2, 1.9, 1.5, 1.2];
    
    const normWinter = normalizeCurve(winterCurve);
    const normSpring = normalizeCurve(springCurve);
    const normSummer = normalizeCurve(summerCurve);

    // 5. BORRAR Y REGENERAR PORTFOLIO
    console.log('🧹 Limpiando tabla PortfolioBaseCurve...');
    await prisma.portfolioBaseCurve.deleteMany();

    const batchSize = 5000;
    let records = [];
    
    // Resetear la fecha al inicio
    dt.setTime(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0));

    for (let i = 0; i < hoursToGenerate; i++) {
      const m = dt.getUTCMonth() + 1;
      const h = dt.getUTCHours(); // 0 a 23

      // Demanda escalada real
      const demandaHoraMwh = preCalculatedDemand[i] * factor_escala;

      // PPA
      let ppaHoraMwh = 0;
      let costePpaEur = 0;
      let activePpas = ppas.filter(p => p.startDate <= dt && (!p.endDate || p.endDate >= dt));

      // Precios de mercado con curva de pato sintética o histórica
      const yyyymm = dt.getUTCFullYear() * 100 + m;
      const futurePrice = futureMap.get(yyyymm) || 65.0;
      const w = dt.getUTCDay();
      
      let selectedCurve = dataDrivenCurves.get(`${m}-${w}`);
      if (!selectedCurve) {
        if ([1, 2, 11, 12].includes(m)) selectedCurve = normWinter;
        else if ([3, 4, 5].includes(m)) selectedCurve = normSpring;
        else selectedCurve = normSummer;
      }

      const ratio = selectedCurve[h];
      const precioOmieReal = futurePrice * ratio;

      for (const p of activePpas) {
        let mwThisHour = 0;
        if (p.subtype === 'CARGA_BASE') {
          mwThisHour = (p.basePowerMw || 0);
        } else if (p.subtype === 'PERFIL_FIJO') {
          const month = dt.getMonth(); // 0-11
          const hour = dt.getHours(); // 0-23
          
          if (p.profileData && Array.isArray(p.profileData)) {
            const profile = p.profileData as any[];
            if (profile[month] && profile[month][hour] !== undefined) {
              const daysInMonth = getDaysInMonth(dt);
              // profileData guarda MWh totales mensuales para esa hora.
              // Para sacar el MW promedio de una hora concreta, dividimos por días del mes.
              mwThisHour = Number(profile[month][hour]) / daysInMonth;
            }
          }
        }
        
        ppaHoraMwh += mwThisHour;
        let ppaPrice = 0;
        if (p.priceType === 'FIJO') {
          ppaPrice = p.priceValue || 0;
        } else if (p.priceType === 'INDEXADO') {
          ppaPrice = precioOmieReal + (p.priceValue || 0);
        }
        costePpaEur += mwThisHour * ppaPrice;
      }

      // Balance
      const compraOmieMwh = Math.max(0, demandaHoraMwh - ppaHoraMwh);
      const ventaOmieMwh = Math.max(0, ppaHoraMwh - demandaHoraMwh);

      const costeCompraEur = compraOmieMwh * precioOmieReal;
      const ingresoVentaEur = ventaOmieMwh * precioOmieReal;
      const costeTotalNetoEur = costePpaEur + costeCompraEur - ingresoVentaEur;
      
      let basePriceEurMwh = precioOmieReal;
      if (demandaHoraMwh > 0) {
        basePriceEurMwh = costeTotalNetoEur / demandaHoraMwh;
      } else if (ppaHoraMwh > 0) {
        // Promedio ponderado del precio de todos los PPAs activos
        basePriceEurMwh = costePpaEur / ppaHoraMwh;
      }

      records.push({
        datetime: new Date(dt),
        basePriceEurMwh,
        omiePriceEurMwh: precioOmieReal,
        demandMwh: demandaHoraMwh,
        ppaMwh: ppaHoraMwh
      });

      if (records.length >= batchSize) {
        await prisma.portfolioBaseCurve.createMany({ data: records, skipDuplicates: true });
        records = [];
      }
      dt.setUTCHours(dt.getUTCHours() + 1);
    }

    if (records.length > 0) {
      await prisma.portfolioBaseCurve.createMany({ data: records, skipDuplicates: true });
    }

    console.log('✅ Orquestación finalizada con arquitectura AED (Contratos + Histórico a 800 días).');
    return NextResponse.json({ success: true, message: `Generadas ${hoursToGenerate} horas.` });

  } catch (error: any) {
    console.error('Error en Orquestador:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
