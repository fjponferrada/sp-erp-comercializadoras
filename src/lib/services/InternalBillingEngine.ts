import { prisma } from '@/lib/prisma';

export interface BillingPeriodBreakdown {
  period: string;
  cchConsumptionMWh: number;
  f1ConsumptionMWh: number;
  energyCostEur: number; // Coste OMIE + OS + RESTRICCIONES * PERDIDAS
  regulatedCostEur: number; // Capacidad + FNEE
}

export interface BillingCalculationResult {
  hasMismatch: boolean;
  mismatchReason?: string;
  totalCchMWh: number;
  totalF1MWh: number;
  periods: Record<string, BillingPeriodBreakdown>;
  
  energyCost: number; // Sum of hourly (OMIE + OS + RESTRICCIONES) * PERDIDAS * MWh
  feeCost: number; // Margin
  capacityCost: number;
  fneeCost: number;
  
  powerCost: number; // Término de potencia facturado al cliente
  peajesDistribuidora: number; // Peajes reales del F1 (solo informativo, no se suma al total)
  cargosDistribuidora: number; // Cargos reales del F1 (solo informativo, no se suma al total)
  
  totalBase: number;
  taxAmount: number;
  totalAmount: number;
  repairData?: any;
}

export function getPeriodoREE(dt: Date, tariff: string): string {
  const m = dt.getUTCMonth() + 1;
  const h = dt.getUTCHours();
  const w = dt.getUTCDay(); 
  const isWeekend = (w === 0 || w === 6);
  const isHol = isWeekend; 
  
  if (tariff.includes('2.0TD')) {
    if (isHol || (h >= 0 && h < 8)) return 'P3';
    if ([8, 9, 14, 15, 16, 17, 22, 23].includes(h)) return 'P2';
    return 'P1';
  }
  
  if (isHol || (h >= 0 && h < 8)) return 'P6';
  if ([1, 2, 7, 12].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P1' : 'P2';
  if ([3, 11].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P2' : 'P3';
  if ([6, 8, 9].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P3' : 'P4';
  return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P4' : 'P5';
}

function getArray(val: any) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

export class InternalBillingEngine {
  
  static async calculate(
    f1Id: string, 
    forceRepair: boolean = false
  ): Promise<BillingCalculationResult> {
    
    const f1 = await prisma.f1Invoice.findUnique({
      where: { id: f1Id },
      include: { contract: true, supplyPoint: true }
    });
    
    if (!f1 || !f1.contract || !f1.supplyPoint) {
      throw new Error("F1 must have contract and supply point");
    }
    
    const contract = f1.contract;
    const tariff = contract.tariff || '3.0TD';
    const startDate = f1.fechaInicio || new Date();
    const endDate = f1.fechaFin || new Date();
    
    // 1. Obtener los volúmenes del F1
    const jsonData = f1.jsonData as any;
    const pEnergia = getArray(jsonData?.EnergiaActiva?.TerminoEnergiaActiva?.Periodo);
    
    const f1VolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    let totalF1MWh = 0;
    
    if (pEnergia && pEnergia.length > 0) {
      for (const p of pEnergia) {
        const pName = p.Periodo || p.periodo; // P1, P2, etc.
        const valorStr = p.ValorEnergiaActiva || p.valorEnergiaActiva || '0';
        // F1 viene en kWh, lo convertimos a MWh
        const valorMWh = parseFloat(valorStr.toString().replace(',', '.')) / 1000.0;
        if (f1VolumesByPeriod[pName] !== undefined) {
          f1VolumesByPeriod[pName] += valorMWh;
        }
        totalF1MWh += valorMWh;
      }
    } else {
      // Fallback si jsonData no existe o es ilegible
      totalF1MWh = (f1.baseImponible || 0) / 100; // Fake fallback
    }

    // 2. Obtener la Curva de Carga Horaria (CCH)
    // Usamos los primeros 20 caracteres del CUPS para evitar problemas con sufijos (ej: 1P, 1F)
    const baseCups = f1.supplyPoint.cups.substring(0, 20);
    
    // La fechaFin del F1 es exclusiva (00:00 del día indicado). 
    // Por tanto, el último día real de consumo es el día anterior.
    const actualEndDate = new Date(endDate.getTime() - 1000);

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: { startsWith: baseCups },
        date: {
          gte: new Date(startDate.toISOString().split('T')[0] + 'T00:00:00Z'),
          lte: new Date(actualEndDate.toISOString().split('T')[0] + 'T23:59:59Z')
        }
      },
      orderBy: { date: 'asc' }
    });

    const cchHourlyMWh: { date: Date, mwh: number, period: string }[] = [];
    let totalCchMWh = 0;

    for (const lc of loadCurves) {
      // Nos aseguramos de estar en rango (endDate es exclusivo, usamos < en lugar de <=)
      if (lc.date < startDate || lc.date >= endDate) continue;
      
      const isHourly = lc.readings.length === 24;
      const isQuarter = lc.readings.length === 96;
      
      for (let h = 0; h < 24; h++) {
        const hourDate = new Date(lc.date);
        hourDate.setUTCHours(h);
        
        let mwh = 0;
        if (isHourly) {
          mwh = lc.readings[h] / 1000.0;
        } else if (isQuarter) {
          mwh = (lc.readings[h*4] + lc.readings[h*4+1] + lc.readings[h*4+2] + lc.readings[h*4+3]) / 1000.0;
        }
        
        const period = getPeriodoREE(hourDate, tariff);
        cchHourlyMWh.push({ date: hourDate, mwh, period });
        totalCchMWh += mwh;
      }
    }

    // 3. Evaluar descuadre
    let hasMismatch = false;
    let mismatchReason = undefined;
    
    if (loadCurves.length === 0) {
      hasMismatch = true;
      mismatchReason = 'Sin datos de curva de carga (CCH) en la BD para estas fechas.';
    } else {
      // Diferencia > 1 kWh (0.001 MWh)
      if (Math.abs(totalF1MWh - totalCchMWh) > 0.001) {
        hasMismatch = true;
        mismatchReason = `Descuadre de volumen: F1 dice ${(totalF1MWh*1000).toFixed(0)} kWh pero la Curva suma ${(totalCchMWh*1000).toFixed(0)} kWh`;
      }
    }

    // Si fuerza reparación o es CCH nulo, generamos un CCH sintético/reparado basado en F1 y un perfil plano
    const originalCchMWh = totalCchMWh; // Guardamos el valor original para el reporte de descuadre

    if ((hasMismatch && forceRepair) || cchHourlyMWh.length === 0) {
      cchHourlyMWh.length = 0; 
      const ms = endDate.getTime() - startDate.getTime();
      const totalHours = Math.ceil(ms / (1000 * 60 * 60)) || 1; 
      
      const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
      const tempHours: { date: Date, period: string }[] = [];
      
      for (let i = 0; i < totalHours; i++) {
        const d = new Date(startDate.getTime() + i * 3600 * 1000);
        const p = getPeriodoREE(d, tariff);
        counts[p]++;
        tempHours.push({ date: d, period: p });
      }
      
      // Asignar MWh equitativamente por periodo (Reparación plana)
      for (const th of tempHours) {
        const targetMWhPeriod = f1VolumesByPeriod[th.period] || 0;
        const mwh = counts[th.period] > 0 ? (targetMWhPeriod / counts[th.period]) : 0;
        cchHourlyMWh.push({ date: th.date, mwh, period: th.period });
      }
      
      totalCchMWh = totalF1MWh;
    }

    // 4. Obtener precios de mercado (SystemComponentPrice y RegulatedCost)
    const datesToQuery = Array.from(new Set(cchHourlyMWh.map(c => c.date.toISOString().split('T')[0])));
    const priceData = await prisma.systemComponentPrice.findMany({
      where: {
        date: { in: datesToQuery.map(d => new Date(d + 'T00:00:00Z')) },
        component: { in: ['OMIE', 'OS', 'RESTRICCIONES', tariff.includes('2.0') ? 'PERD_20TD' : (tariff.includes('6.1') ? 'PERD_61TD' : 'PERD_30TD')] }
      }
    });

    const omieMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    const restMap = new Map<string, number>();
    const perdMap = new Map<string, number>();
    
    for (const pd of priceData) {
      const dateKey = pd.date.toISOString().split('T')[0];
      for (let h = 0; h < 24; h++) {
        const key = `${dateKey}_${h}`;
        if (pd.component === 'OMIE') omieMap.set(key, pd.values[h] || 0);
        else if (pd.component === 'OS') osMap.set(key, pd.values[h] || 0);
        else if (pd.component === 'RESTRICCIONES') restMap.set(key, pd.values[h] || 0);
        else perdMap.set(key, pd.values[h] || 0);
      }
    }

    const regCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: endDate },
        validTo: { gte: startDate }
      }
    });

    let fneeCost = 0;
    let capCost = 0;
    for (const reg of regCosts) {
      if (reg.concept === 'FNEE') fneeCost = reg.singleValue || 0;
      if (reg.concept === 'CAPACIDAD') capCost = reg.singleValue || 0;
    }

    // 5. Motor de cálculo horario
    let totalEnergyCost = 0;
    let totalCapacityCost = 0;
    let totalFneeCost = 0;
    const periodsBreakdown: Record<string, BillingPeriodBreakdown> = {
      P1: { period: 'P1', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P1']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P2: { period: 'P2', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P2']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P3: { period: 'P3', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P3']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P4: { period: 'P4', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P4']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P5: { period: 'P5', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P5']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P6: { period: 'P6', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P6']||0, energyCostEur: 0, regulatedCostEur: 0 }
    };

    const isFixed = contract.pricingModel === 'FIJO';

    for (const hData of cchHourlyMWh) {
      const dateKey = hData.date.toISOString().split('T')[0];
      const hour = hData.date.getUTCHours();
      const key = `${dateKey}_${hour}`;
      
      const mwh = hData.mwh;
      if (mwh <= 0) continue;

      const p = hData.period;
      if (!periodsBreakdown[p]) continue; // Seguridad
      
      periodsBreakdown[p].cchConsumptionMWh += mwh;

      if (isFixed) {
        const pNum = parseInt(p.replace('P', '')) || 1;
        const fixedPrice = (contract as any)[`p${pNum}e`] || 60; // €/MWh
        const hCost = fixedPrice * mwh;
        totalEnergyCost += hCost;
        periodsBreakdown[p].energyCostEur += hCost;
      } else {
        const omie = omieMap.get(key) || 50; 
        const os = osMap.get(key) || 2;
        const rest = restMap.get(key) || 1;
        const desvio = contract.deviationCost || 0;
        
        let pctPerd = perdMap.get(key) || 0;
        if (pctPerd > 2.0) pctPerd /= 100.0;
        const lossFactor = 1 + pctPerd;

        const basePrecioUnit = (omie + os + rest + desvio) * lossFactor;
        const hEnergyCost = basePrecioUnit * mwh;

        totalEnergyCost += hEnergyCost;
        periodsBreakdown[p].energyCostEur += hEnergyCost;
        
        const regUnit = capCost + fneeCost; 
        const hRegCost = regUnit * mwh;
        totalCapacityCost += (capCost * mwh);
        totalFneeCost += (fneeCost * mwh);
        periodsBreakdown[p].regulatedCostEur += hRegCost;
      }
    }

    // 6. Consolidación de costes
    const feeCost = (contract.fee || 5) * totalCchMWh;
    
    // Solo informativos (no se facturan al cliente)
    const peajesDistribuidora = f1.totalPeajes || 0;
    const cargosDistribuidora = f1.totalCargos || 0;

    // Cálculo Término de Potencia con precios pactados en contrato
    const billingDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    
    const p1c = f1.supplyPoint.p1c || 0;
    const p2c = f1.supplyPoint.p2c || 0;
    const p3c = f1.supplyPoint.p3c || 0;
    const p4c = f1.supplyPoint.p4c || 0;
    const p5c = f1.supplyPoint.p5c || 0;
    const p6c = f1.supplyPoint.p6c || 0;

    const p1p = contract.p1p || 0;
    const p2p = contract.p2p || 0;
    const p3p = contract.p3p || 0;
    const p4p = contract.p4p || 0;
    const p5p = contract.p5p || 0;
    const p6p = contract.p6p || 0;

    const isYearlyPower = p1p > 2; // Si es mayor de 2€, asumimos €/kW/año
    const daysMultiplier = isYearlyPower ? (billingDays / 365.0) : billingDays;

    let powerCost = 0;
    powerCost += p1c * p1p * daysMultiplier;
    powerCost += p2c * p2p * daysMultiplier;
    powerCost += p3c * p3p * daysMultiplier;
    powerCost += p4c * p4p * daysMultiplier;
    powerCost += p5c * p5p * daysMultiplier;
    powerCost += p6c * p6p * daysMultiplier;

    let totalBase = totalEnergyCost + totalCapacityCost + totalFneeCost + feeCost + powerCost;

    // Tasa municipal = 1.5% del importe de la energía. Solo aplica en INDEXADO.
    if (!isFixed) {
      const tasaMunicPercentage = 1.5;
      // Solo sobre la parte de energía y potencia (totalBase antes de impuestos)
      totalBase = totalBase * (1 + (tasaMunicPercentage / 100));
    }

    const taxAmount = totalBase * 0.21; // IVA 21%
    const totalAmount = totalBase + taxAmount;

    return {
      hasMismatch,
      mismatchReason,
      totalCchMWh,
      totalF1MWh,
      periods: periodsBreakdown,
      energyCost: totalEnergyCost,
      feeCost,
      capacityCost: totalCapacityCost,
      fneeCost: totalFneeCost,
      powerCost,
      peajesDistribuidora,
      cargosDistribuidora,
      totalBase,
      taxAmount,
      totalAmount,
      repairData: hasMismatch ? { issue: mismatchReason, f1Volume: totalF1MWh, cchVolume: originalCchMWh } : null
    };
  }
}
