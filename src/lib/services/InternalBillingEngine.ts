import { prisma } from '@/lib/prisma';
import { fromZonedTime } from 'date-fns-tz';

export interface BillingPeriodBreakdown {
  period: string;
  cchConsumptionMWh: number;
  f1ConsumptionMWh: number;
  energyCostEur: number; // For fixed: PxE * MWh. For indexed: Ph * MWh
  regulatedCostEur: number; // Peajes + Cargos de energía (for reference)
}

export interface BillingCalculationResult {
  hasMismatch: boolean;
  mismatchReason?: string;
  totalCchMWh: number;
  totalF1MWh: number;
  periods: Record<string, BillingPeriodBreakdown>;
  
  energyCost: number; 
  feeCost: number; 
  capacityCost: number;
  fneeCost: number;
  bonoSocial: number;
  
  powerCost: number; // Término de potencia facturado al cliente
  peajesDistribuidora: number; // Peajes (referencia calculada BOE o F1)
  cargosDistribuidora: number; // Cargos (referencia calculada BOE o F1)
  
  totalBase: number;
  taxAmount: number;
  totalAmount: number;
  alquilerEquipo?: number;
  taxElectric?: number;
  excesosPotencia?: number;
  excedentesAutoconsumo?: number;
  maxExcedentes?: number;
  bolsilloSolarLlenado?: number;
  hourlyDetails: any[];
  reactiveEnergyCost: number;
  reactiveDetails: any[];
  repairData: any | null;
  svaCost?: number;
  svaConcept?: string;
  
  powerDetails?: any[];
  energyAtrDetails?: any[];
  energyMarketDetails?: any[];

  // Margins
  energyMargin?: number;
  powerMargin?: number;
  f1Readings?: any;
  excedentesKwh?: number;
  pexc?: number | null;
  isFixed?: boolean;
}

export function getPeriodoREE(dt: Date, tariff: string): string {
  const localStr = dt.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
  const y = parseInt(localStr.substring(0, 4), 10);
  const m = parseInt(localStr.substring(5, 7), 10);
  const d = parseInt(localStr.substring(8, 10), 10);
  const h = parseInt(localStr.substring(11, 13), 10);
  
  const localDateObj = new Date(y, m - 1, d);
  const w = localDateObj.getDay(); 
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
  if ([4, 5, 10].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P4' : 'P5';
  if ([6, 8, 9].includes(m)) return (h >= 9 && h < 14) || (h >= 18 && h < 22) ? 'P3' : 'P4';
  
  return 'P6';
}

function getArray(val: any) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

export class InternalBillingEngine {
  
  static async calculate(
    f1Id: string, 
    forceRepair: boolean = false,
    returnHourlyDetails: boolean = false
  ): Promise<BillingCalculationResult> {
    
    const f1 = await prisma.f1Invoice.findUnique({
      where: { id: f1Id },
      include: { 
        contract: { include: { product: true } }, 
        supplyPoint: true 
      }
    });
    
    if (!f1 || !f1.contract || !f1.supplyPoint) {
      throw new Error("F1 must have contract and supply point");
    }
    
    const contract = f1.contract;
    const tariff = f1.supplyPoint.tariff || '3.0TD';
    // startDate and endDate are calculated below
    // 1. Obtener los volúmenes del F1
    const jsonData = f1.jsonData as any;
    
    let isAbono = false;
    let isAbonoAproximado = false;
    const datosGen = jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura || jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura || jsonData?.DatosGeneralesFactura;
    if (datosGen && datosGen.TipoFactura) {
       const t = Array.isArray(datosGen.TipoFactura) ? datosGen.TipoFactura[0] : datosGen.TipoFactura;
       if (t === 'S' || t === 'AR' || t === 'A') {
         isAbono = true;
         // --- REVERSE ENGINEERING FOR AR / A INVOICES ---
         // Instead of recalculating from CCH curves, we find the original N invoice
         // and clone its calculation, inverting all mathematical signs to guarantee 0% error.
         
         let originalNCode: string | null = null;
         
         if (t === 'A') {
            originalNCode = datosGen.CodigoFacturaRectificadaAnulada;
         } else {
            const allR = await prisma.f1Invoice.findMany({
              where: { supplyPointId: f1.supplyPointId, jsonData: { not: Array.isArray([]) ? [] : {} } }
            });
            
            for (const r of allR) {
              const rGen = (r.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                        || (r.jsonData as any)?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura 
                        || (r.jsonData as any)?.DatosGeneralesFactura;
              const rOriginalCode = rGen?.CodigoFacturaRectificadaAnulada;
              const codAbono = rGen?.CodigoFacturaAbono || (rOriginalCode ? `AR-${rOriginalCode}` : undefined);
              if (codAbono === f1.numeroFactura) {
                 originalNCode = rOriginalCode;
                 break;
              }
            }
         }
         
         if (originalNCode) {
            const originalF1 = await prisma.f1Invoice.findFirst({ where: { numeroFactura: String(originalNCode) } });
            if (originalF1) {
               let originalResult: BillingCalculationResult | null = null;
               const internalInvoice = await prisma.internalInvoice.findFirst({ where: { f1InvoiceId: originalF1.id } });
               if (internalInvoice && internalInvoice.invoiceData) {
                  originalResult = internalInvoice.invoiceData as unknown as BillingCalculationResult;
                  // Inject root-level properties that might not be saved in older invoiceData JSON blobs
                  originalResult.totalBase = originalResult.totalBase ?? internalInvoice.subtotal1 ?? 0;
                  originalResult.taxAmount = originalResult.taxAmount ?? internalInvoice.taxAmount ?? 0;
                  originalResult.totalAmount = originalResult.totalAmount ?? internalInvoice.totalAmount ?? 0;
                  originalResult.totalF1MWh = originalResult.totalF1MWh ?? internalInvoice.totalMWh ?? 0;
                  originalResult.feeCost = originalResult.feeCost ?? internalInvoice.margin ?? 0;
               }
               
               if (originalResult) {
                 const clone = JSON.parse(JSON.stringify(originalResult)) as BillingCalculationResult;
                 const invert = (val: number | undefined) => val !== undefined && val !== null ? -val : undefined;
                 clone.totalAmount = invert(clone.totalAmount) as number;
                 clone.totalBase = invert(clone.totalBase) as number;
                 clone.taxAmount = invert(clone.taxAmount) as number;
                 clone.powerMargin = invert(clone.powerMargin);
                 clone.energyMargin = invert(clone.energyMargin);
                 clone.energyCost = invert(clone.energyCost) as number;
                 clone.feeCost = invert(clone.feeCost) as number;
                 clone.capacityCost = invert(clone.capacityCost) as number;
                 clone.fneeCost = invert(clone.fneeCost) as number;
                 clone.bonoSocial = invert(clone.bonoSocial) as number;
                 clone.peajesDistribuidora = invert(clone.peajesDistribuidora) as number;
                 clone.cargosDistribuidora = invert(clone.cargosDistribuidora) as number;
                 clone.alquilerEquipo = invert(clone.alquilerEquipo);
                 clone.taxElectric = invert(clone.taxElectric);
                 clone.excesosPotencia = invert(clone.excesosPotencia);
                 clone.excedentesAutoconsumo = invert(clone.excedentesAutoconsumo);
                 clone.powerCost = invert(clone.powerCost) as number;
                 clone.reactiveEnergyCost = invert(clone.reactiveEnergyCost) as number;
                 clone.maxExcedentes = invert(clone.maxExcedentes);
                 clone.bolsilloSolarLlenado = invert(clone.bolsilloSolarLlenado);
                 clone.totalF1MWh = invert(clone.totalF1MWh) as number;
                 clone.totalCchMWh = invert(clone.totalCchMWh) as number;
                 
                 if (clone.repairData) {
                   clone.repairData.f1Volume = invert(clone.repairData.f1Volume);
                   clone.repairData.cchVolume = invert(clone.repairData.cchVolume);
                 }
                 if (clone.periods) {
                   for (const p in clone.periods) {
                     clone.periods[p].energyCostEur = invert(clone.periods[p].energyCostEur) as number;
                     clone.periods[p].regulatedCostEur = invert(clone.periods[p].regulatedCostEur) as number;
                     clone.periods[p].cchConsumptionMWh = invert(clone.periods[p].cchConsumptionMWh) as number;
                     clone.periods[p].f1ConsumptionMWh = invert(clone.periods[p].f1ConsumptionMWh) as number;
                   }
                 }
                 if (clone.hourlyDetails) {
                   for (const h of clone.hourlyDetails) {
                     h.omieCost = invert(h.omieCost);
                     h.regulatedCost = invert(h.regulatedCost);
                     h.totalCost = invert(h.totalCost);
                     h.fnee = invert(h.fnee);
                   }
                 }
                 if (clone.energyMarketDetails) {
                   for (const m of clone.energyMarketDetails) {
                     m.totalEur = invert(m.totalEur);
                   }
                 }
                 if (clone.energyAtrDetails) {
                   for (const m of clone.energyAtrDetails) {
                     m.totalEur = invert(m.totalEur);
                   }
                 }
                 if (clone.powerDetails) {
                   for (const m of clone.powerDetails) {
                     m.totalEur = invert(m.totalEur);
                   }
                 }
                 
                 return clone;
               } else {
                 isAbonoAproximado = true;
               }
            } else {
              isAbonoAproximado = true;
            }
         } else {
           isAbonoAproximado = true;
         }
       }
    }

    const termActiva = getArray(jsonData?.EnergiaActiva?.TerminoEnergiaActiva);
    const pEnergia = termActiva.flatMap((t: any) => getArray(t?.Periodo));
    
    const f1VolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    let totalF1MWh = 0;
    
    const f1Readings: Record<string, { actIni: string, actFin: string, reactIni: string, reactFin: string, reactCons: number, actCons: number, max: number }> = {};
    for (let i=1; i<=6; i++) f1Readings[`P${i}`] = { actIni: '-', actFin: '-', reactIni: '-', reactFin: '-', reactCons: 0, actCons: 0, max: 0 };
    
    if (pEnergia && pEnergia.length > 0) {
      for (let idx = 0; idx < pEnergia.length; idx++) {
        const p = pEnergia[idx];
        const pName = p.Periodo || p.periodo || `P${idx + 1}`;
        const valorStr = p.ValorEnergiaActiva || p.valorEnergiaActiva || '0';
        let kwh = parseFloat(valorStr.toString().replace(',', '.'));
        if (isAbono) kwh = Math.abs(kwh);
        const valorMWh = kwh / 1000.0;
        if (f1VolumesByPeriod[pName] !== undefined) {
          f1VolumesByPeriod[pName] += valorMWh;
        }
        totalF1MWh += valorMWh;
        
        if (f1Readings[pName]) {
          f1Readings[pName].actCons += kwh;
        }
      }
    } else {
      throw new Error("El fichero F1 (XML) no contiene desgloses de Energía Activa o es ilegible.");
    }
    
    const termExcedentaria = getArray(jsonData?.Autoconsumo?.EnergiaExcedentaria?.TerminoEnergiaExcedentaria);
    const pExcedentaria = termExcedentaria.flatMap((t: any) => getArray(t?.Periodo));
    const f1SurplusVolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    let totalF1SurplusMWh = 0;
    if (pExcedentaria && pExcedentaria.length > 0) {
      for (let idx = 0; idx < pExcedentaria.length; idx++) {
        const p = pExcedentaria[idx];
        const pName = p.Periodo || p.periodo || `P${idx + 1}`;
        const valorStr = p.ValorEnergiaExcedentaria || p.valorEnergiaExcedentaria || '0';
        let kwh = parseFloat(valorStr.toString().replace(',', '.'));
        if (isAbono) kwh = Math.abs(kwh);
        const valorMWh = kwh / 1000.0;
        if (f1SurplusVolumesByPeriod[pName] !== undefined) {
          f1SurplusVolumesByPeriod[pName] += valorMWh;
        }
        totalF1SurplusMWh += valorMWh;
      }
    }

    const termReactiva = getArray(jsonData?.EnergiaReactiva?.TerminoEnergiaReactiva);
    const pReactiva = termReactiva.flatMap((t: any) => getArray(t?.Periodo));
    if (pReactiva && pReactiva.length > 0) {
      for (const p of pReactiva) {
        const pName = p.Periodo || p.periodo;
        if (pName && f1Readings[pName]) {
          let val = parseFloat((p.ValorEnergiaReactiva || p.valorEnergiaReactiva || '0').toString().replace(',', '.'));
          if (isAbono) val = Math.abs(val);
          f1Readings[pName].reactCons = val;
        }
      }
    }

    const termMax = getArray(jsonData?.Potencias?.TerminosPotencia);
    const pMax = termMax.flatMap((t: any) => getArray(t?.Periodo));
    if (pMax && pMax.length > 0) {
      for (const p of pMax) {
        const pName = p.Periodo || p.periodo;
        if (pName && f1Readings[pName]) {
          let val = parseFloat((p.PotenciaMaxDemandada || p.potenciaMaxDemandada || p.PotenciaMaxima || p.potenciaMaxima || '0').toString().replace(',', '.'));
          if (isAbono) val = Math.abs(val);
          f1Readings[pName].max = val;
        }
      }
    }

    // Extract actual readings from Medidas
    const arrFacturasATR = getArray(jsonData?.Facturas?.FacturaATR);
    const medidas = jsonData?.Medidas || arrFacturasATR?.[0]?.Medidas;
    if (medidas) {
      const modelos = getArray(medidas.ModeloAparato);
      for (const mod of modelos) {
        const integradores = getArray(mod.Integrador);
        for (const intg of integradores) {
          const mag = intg.Magnitud;
          const cod = intg.CodigoPeriodo?.toString();
          
          let pName = '';
          if (cod && cod.length > 0) {
            const lastChar = cod.substring(cod.length - 1);
            if (['1','2','3','4','5','6'].includes(lastChar)) {
              pName = `P${lastChar}`;
            }
          }
          
          if (pName && f1Readings[pName]) {
            const lDesde = intg.LecturaDesde?.Lectura ?? intg.lecturaDesde?.lectura;
            const lHasta = intg.LecturaHasta?.Lectura ?? intg.lecturaHasta?.lectura;
            const consCalc = intg.ConsumoCalculado ?? intg.consumoCalculado;
            
            if (mag === 'AE' || mag === '1') {
               if (lDesde !== undefined) f1Readings[pName].actIni = lDesde.toString();
               if (lHasta !== undefined) f1Readings[pName].actFin = lHasta.toString();
               if (consCalc !== undefined) {
                 let val = parseFloat(consCalc.toString());
                 if (isAbono) val = Math.abs(val);
                 f1Readings[pName].actCons = val;
               }
            } else if (mag === 'R1' || mag === '2') {
               if (lDesde !== undefined) f1Readings[pName].reactIni = lDesde.toString();
               if (lHasta !== undefined) f1Readings[pName].reactFin = lHasta.toString();
               if (consCalc !== undefined) {
                 let val = parseFloat(consCalc.toString());
                 if (isAbono) val = Math.abs(val);
                 f1Readings[pName].reactCons = val;
               }
            } else if (mag === 'PM' || mag === '3') {
               let val = 0;
               if (consCalc !== undefined) val = parseFloat(consCalc.toString());
               else if (lHasta !== undefined) val = parseFloat(lHasta.toString());
               
               if (isAbono) val = Math.abs(val);
               
               if (val > 1000) val = val / 1000.0;
               
               if (val > 0) f1Readings[pName].max = val;
            }
          }
        }
      }
    }

    const f1StartDate = f1.fechaInicio || new Date();
    const f1StartIsoStr = f1StartDate.toISOString().substring(0, 10);
    const startDate = fromZonedTime(`${f1StartIsoStr}T00:00:00`, 'Europe/Madrid');
    
    const f1EndDate = f1.fechaFin || new Date();
    const f1EndIsoStr = f1EndDate.toISOString().substring(0, 10);
    const endDate = fromZonedTime(`${f1EndIsoStr}T00:00:00`, 'Europe/Madrid');

    const baseCups = f1.supplyPoint.cups.substring(0, 20);
    const actualEndDate = new Date(endDate.getTime() - 1000);

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: { startsWith: baseCups },
        date: {
          gte: new Date(startDate.getTime() - 24 * 3600 * 1000),
          lte: new Date(actualEndDate.getTime() + 24 * 3600 * 1000)
        }
      },
      orderBy: { date: 'asc' }
    });
    
    const consumptionCurves = loadCurves.filter(c => c.type === 'CONSUMPTION');
    const surplusCurves = loadCurves.filter(c => c.type === 'SURPLUS');

    const cchHourlyMWh: { date: Date, mwh: number, period: string, isQuarterHour: boolean }[] = [];
    let totalCchMWh = 0;
    const cchVolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };

    for (const lc of consumptionCurves) {
      
      const isQuarter = lc.readings.length === 96;
      
      if (isQuarter) {
        for (let q = 0; q < 96; q++) {
          // Fix UTC timezone shift: parse local Madrid date correctly
          const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
          const localStr = `${dateIsoStr}T${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}:00`;
          const qDate = fromZonedTime(localStr, 'Europe/Madrid');
          
          if (qDate < startDate || qDate >= endDate) continue;
          
          const mwh = (lc.readings[q] || 0) / 1000.0;
          const period = getPeriodoREE(qDate, tariff);
          cchHourlyMWh.push({ date: qDate, mwh, period, isQuarterHour: true });
          totalCchMWh += mwh;
          if (cchVolumesByPeriod[period] !== undefined) cchVolumesByPeriod[period] += mwh;
        }
      } else {
        // Fallback: Si la curva viene en formato horario (24 lecturas), 
        // la dividimos en 4 cuartos de hora iguales para que el excel cuadre con 2880.
        for (let h = 0; h < 24; h++) {
          const mwhHour = (lc.readings[h] || 0) / 1000.0;
          const mwhQuarter = mwhHour / 4.0;
          for (let q = 0; q < 4; q++) {
            // Fix UTC timezone shift: parse local Madrid date correctly
            const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
            const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
            const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
            
            if (hourDate < startDate || hourDate >= endDate) continue;
            
            const period = getPeriodoREE(hourDate, tariff);
            cchHourlyMWh.push({ date: hourDate, mwh: mwhQuarter, period, isQuarterHour: true });
            totalCchMWh += mwhQuarter;
            if (cchVolumesByPeriod[period] !== undefined) cchVolumesByPeriod[period] += mwhQuarter;
          }
        }
      }
    }

    const cchSurplusHourlyMWh: { date: Date, mwh: number, period: string, isQuarterHour: boolean }[] = [];
    let totalCchSurplusMWh = 0;
    const cchSurplusVolumesByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };

    for (const lc of surplusCurves) {
      const isQuarter = lc.readings.length === 96;
      if (isQuarter) {
        for (let q = 0; q < 96; q++) {
          const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
          const localStr = `${dateIsoStr}T${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}:00`;
          const qDate = fromZonedTime(localStr, 'Europe/Madrid');
          if (qDate < startDate || qDate >= endDate) continue;
          
          const mwh = (lc.readings[q] || 0) / 1000.0;
          const period = getPeriodoREE(qDate, tariff);
          cchSurplusHourlyMWh.push({ date: qDate, mwh, period, isQuarterHour: true });
          totalCchSurplusMWh += mwh;
          if (cchSurplusVolumesByPeriod[period] !== undefined) cchSurplusVolumesByPeriod[period] += mwh;
        }
      } else {
        for (let h = 0; h < 24; h++) {
          const mwhHour = (lc.readings[h] || 0) / 1000.0;
          const mwhQuarter = mwhHour / 4.0;
          for (let q = 0; q < 4; q++) {
            const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
            const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
            const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
            if (hourDate < startDate || hourDate >= endDate) continue;
            
            const period = getPeriodoREE(hourDate, tariff);
            cchSurplusHourlyMWh.push({ date: hourDate, mwh: mwhQuarter, period, isQuarterHour: true });
            totalCchSurplusMWh += mwhQuarter;
            if (cchSurplusVolumesByPeriod[period] !== undefined) cchSurplusVolumesByPeriod[period] += mwhQuarter;
          }
        }
      }
    }

    // 3. Evaluar descuadre
    const originalCchMWh = totalCchMWh;
    const allowedEnergyMargin = 0.001; 
    const uniqueDates = new Set(cchHourlyMWh.map(c => {
      return c.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
    })).size;
    const foundDays = uniqueDates;
    const expectedDays = Math.round((actualEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let hasMismatch = false;
    let mismatchReason = undefined;
    
    if (foundDays < expectedDays && expectedDays > 0) {
      hasMismatch = true;
      mismatchReason = `Descuadre de días: El F1 factura ${expectedDays} días pero la curva (CCH) solo tiene datos de ${foundDays} días.`;
    } else if (Math.abs(totalF1MWh - totalCchMWh) > allowedEnergyMargin) {
      hasMismatch = true;
      mismatchReason = `Descuadre de volumen total: F1 dice ${(totalF1MWh*1000).toFixed(0)} kWh pero la Curva suma ${(totalCchMWh*1000).toFixed(0)} kWh`;
    } else {
      // Chequeo de descuadre por periodo
      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        if (f1VolumesByPeriod[p] > 0 || cchVolumesByPeriod[p] > 0) {
          if (Math.abs(f1VolumesByPeriod[p] - cchVolumesByPeriod[p]) > allowedEnergyMargin) {
            hasMismatch = true;
            mismatchReason = `Descuadre en ${p}: F1 dice ${(f1VolumesByPeriod[p]*1000).toFixed(0)} kWh pero CCH suma ${(cchVolumesByPeriod[p]*1000).toFixed(0)} kWh`;
            break;
          }
        }
      }
    }
    
    if (totalF1SurplusMWh > 0) {
      if (cchSurplusHourlyMWh.length === 0) {
        hasMismatch = true;
        const msg = 'Sin datos de curva de excedentes (CCH) en BD.';
        mismatchReason = mismatchReason ? mismatchReason + " | " + msg : msg;
      } else if (Math.abs(totalF1SurplusMWh - totalCchSurplusMWh) > allowedEnergyMargin) {
        hasMismatch = true;
        const msg = `Descuadre de excedentes: F1 dice ${(totalF1SurplusMWh*1000).toFixed(0)} kWh pero la CCH Excedentes suma ${(totalCchSurplusMWh*1000).toFixed(0)} kWh`;
        mismatchReason = mismatchReason ? mismatchReason + " | " + msg : msg;
      }
    }
    
    if (consumptionCurves.length === 0) {
      hasMismatch = true;
      mismatchReason = mismatchReason ? mismatchReason + ' | Sin datos de curva de consumo (CCH) en BD.' : 'Sin datos de curva de consumo (CCH) en BD.';
    }

    if (isAbonoAproximado) {
       const msg = "⚠️ ABONO APROXIMADO: Factura original no encontrada en BD. Cálculo por aproximación.";
       mismatchReason = mismatchReason ? mismatchReason + " | " + msg : msg;
    }

    let originalMismatchReason = mismatchReason;

    if (hasMismatch && !forceRepair) {
      return {
        totalBase: 0, taxAmount: 0, totalAmount: 0, totalCchMWh,
        energyCost: 0, capacityCost: 0, fneeCost: 0, powerCost: 0,
        feeCost: 0, peajesDistribuidora: 0, cargosDistribuidora: 0,
        hasMismatch: true,
        periods: {},
        repairData: {
          issue: mismatchReason,
          f1Volume: totalF1MWh,
          cchVolume: totalCchMWh,
          f1Id
        }
      } as any;
    }

    // 1. Cargar perfiles REE del año (necesario para consumos o excedentes)
    const targetYear = startDate.getFullYear();
    let reeProfiles = await prisma.reeProfile.findMany({
      where: { year: targetYear }
    });
    if (reeProfiles.length === 0) {
      const lastYear = await prisma.reeProfile.findFirst({ orderBy: { year: 'desc' } });
      if (lastYear) {
        reeProfiles = await prisma.reeProfile.findMany({ where: { year: lastYear.year } });
      }
    }
    
    const tipoPerfil = tariff.includes('2.0') ? 'p20td' : (tariff.includes('3.0TDVE') ? 'p30tdve' : 'p30td');
    const getCoef = (d: Date, isSurplus: boolean = false) => {
      const localD = new Date(d.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }));
      const m = localD.getMonth() + 1;
      const dom = localD.getDate();
      let h = localD.getHours();
      if (h === 0) h = 24; // REE profiles use hours 1-24
      const prof = reeProfiles.find(r => r.month === m && r.day === dom && r.hour === h);
      if (!prof) return 0.0001;
      const key = isSurplus ? 'pSolar' : tipoPerfil;
      const val = (prof as any)[key];
      return val !== null && val !== undefined ? val : 0.0001;
    };

    if ((hasMismatch && forceRepair) || cchHourlyMWh.length === 0) {
      if (cchHourlyMWh.length === 0) {
        // Generar curva completa perfilada
        const ms = endDate.getTime() - startDate.getTime();
        const totalQuarters = Math.ceil(ms / (1000 * 60 * 15)) || 1; 
        
        const tempQuarters: { date: Date, period: string, coef: number }[] = [];
        const sumCoefByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
        
        for (let i = 0; i < totalQuarters; i++) {
          const d = new Date(startDate.getTime() + i * 15 * 60 * 1000);
          const p = getPeriodoREE(d, tariff);
          const coef = getCoef(d);
          sumCoefByPeriod[p] += coef;
          tempQuarters.push({ date: d, period: p, coef });
        }
        
        for (const tq of tempQuarters) {
          const targetMWhPeriod = f1VolumesByPeriod[tq.period] || 0;
          const sumCoef = sumCoefByPeriod[tq.period];
          const mwh = sumCoef > 0 ? (targetMWhPeriod * (tq.coef / sumCoef)) : 0;
          cchHourlyMWh.push({ date: tq.date, mwh, period: tq.period, isQuarterHour: true });
        }
      } else {
        // Reparación por Escalado Proporcional (Mantiene el perfil real del cliente)
        const ms = endDate.getTime() - startDate.getTime();
        const totalQuarters = Math.ceil(ms / (1000 * 60 * 15)) || 1; 
        
        const sumCoefByPeriod: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
        const quarterCoefs = new Array(cchHourlyMWh.length);

        for (let i = 0; i < cchHourlyMWh.length; i++) {
           const c = cchHourlyMWh[i];
           const coef = getCoef(c.date);
           quarterCoefs[i] = coef;
           sumCoefByPeriod[c.period] += coef;
        }

        for (let i = 0; i < cchHourlyMWh.length; i++) {
          const c = cchHourlyMWh[i];
          const p = c.period;
          const f1Vol = f1VolumesByPeriod[p] || 0;
          const cchVol = cchVolumesByPeriod[p] || 0;

          if (f1Vol === 0) {
            c.mwh = 0; // El F1 no marca consumo, forzamos a 0
          } else if (cchVol > 0) {
            // Factor de corrección: Reparte el defecto/exceso proporcionalmente 
            // sobre las horas donde SÍ hubo consumo, manteniendo la forma de la curva
            const factor = f1Vol / cchVol;
            c.mwh = c.mwh * factor;
          } else {
            // La CCH tiene 0 absoluto en este periodo, pero el F1 dice que hay consumo.
            // Generamos consumo perfilado (antes era plano).
            const coef = quarterCoefs[i];
            const sumCoef = sumCoefByPeriod[p];
            c.mwh = sumCoef > 0 ? (f1Vol * (coef / sumCoef)) : 0;
          }
        }
      }
      
      totalCchMWh = totalF1MWh;
      hasMismatch = false;
      mismatchReason = undefined;
    }

    if ((hasMismatch && forceRepair) || (cchSurplusHourlyMWh.length === 0 && totalF1SurplusMWh > 0)) {
      if (cchSurplusHourlyMWh.length === 0) {
        // Generar curva completa perfilada para excedentes usando pSolar GLOBAL (ignorando periodos F1)
        const ms = endDate.getTime() - startDate.getTime();
        const totalQuarters = Math.ceil(ms / (1000 * 60 * 15)) || 1; 
        
        const tempQuarters: { date: Date, period: string, coef: number }[] = [];
        let totalSumCoef = 0;
        
        for (let i = 0; i < totalQuarters; i++) {
          const d = new Date(startDate.getTime() + i * 15 * 60 * 1000);
          const p = getPeriodoREE(d, tariff);
          const coef = getCoef(d, true);
          totalSumCoef += coef;
          tempQuarters.push({ date: d, period: p, coef });
        }
        
        for (const tq of tempQuarters) {
          const mwh = totalSumCoef > 0 ? (totalF1SurplusMWh * (tq.coef / totalSumCoef)) : 0;
          cchSurplusHourlyMWh.push({ date: tq.date, mwh, period: tq.period, isQuarterHour: true });
        }
      } else {
        // Reparación por Escalado Proporcional GLOBAL para excedentes (respetando la forma de la curva real)
        const factor = totalCchSurplusMWh > 0 ? totalF1SurplusMWh / totalCchSurplusMWh : 0;
        for (let i = 0; i < cchSurplusHourlyMWh.length; i++) {
          const c = cchSurplusHourlyMWh[i];
          c.mwh = c.mwh * factor;
        }
      }
      totalCchSurplusMWh = totalF1SurplusMWh;
    }

    // 4. Obtener precios de mercado (SystemComponentPrice y RegulatedCost)
    const datesToQueryStr = Array.from(new Set(cchHourlyMWh.map(c => c.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10))));
    const priceData = await prisma.systemComponentPrice.findMany({
      where: {
        date: { in: datesToQueryStr.map(d => new Date(d + 'T00:00:00Z')) },
        component: { in: ['OMIE', 'RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'K', tariff.includes('2.0') ? 'PERD_20TD' : (tariff.includes('6.1') ? 'PERD_61TD' : 'PERD_30TD')] }
      }
    });

    const omieMap = new Map<string, number>();
    const kMap = new Map<string, number>();
    const perdMap = new Map<string, number>();
    
    const individualComps = ['RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP'];
    const compMaps: Record<string, Map<string, number>> = {};
    for (const c of individualComps) {
       compMaps[c] = new Map<string, number>();
    }
    
    for (const pd of priceData) {
      const dateKey = pd.date.toISOString().split('T')[0];
      const isQuarterly = pd.values.length >= 96;
      
      const numVals = isQuarterly ? 96 : 24;
      for (let i = 0; i < numVals; i++) {
        if (isQuarterly) {
          const h = Math.floor(i / 4);
          const m = (i % 4) * 15;
          const key = `${dateKey}_${h}_${m}`;
          const val = pd.values[i] || 0;
          if (pd.component === 'OMIE') omieMap.set(key, val);
          else if (pd.component === 'K') kMap.set(key, pd.values[i] || 1);
          else if (individualComps.includes(pd.component)) compMaps[pd.component].set(key, val);
          else perdMap.set(key, val);
        } else {
          const val = pd.values[i] || 0;
          for (let q = 0; q < 4; q++) {
            const key = `${dateKey}_${i}_${q * 15}`;
            if (pd.component === 'OMIE') omieMap.set(key, val);
            else if (pd.component === 'K') kMap.set(key, pd.values[i] || 1);
            else if (individualComps.includes(pd.component)) compMaps[pd.component].set(key, val);
            else perdMap.set(key, val);
          }
        }
      }
    }

    const regCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: endDate },
        validTo: { gt: startDate }
      },
      orderBy: { validFrom: 'asc' }
    });

    let refDate = contract.signatureDate;
    if (!refDate) {
      const getJsonDate = (json: any, key: string) => {
        if (!json || typeof json !== 'object') return null;
        const val = json[key];
        if (!val) return null;
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        if (typeof val === 'string' && val.includes('/')) {
           const parts = val.split('/');
           if (parts.length === 3) {
             const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
             if (!isNaN(d2.getTime())) return d2;
           }
        }
        return null;
      };

      refDate = getJsonDate((contract as any).jsonData, 'FECHA FIRMA') || getJsonDate((contract as any).jsonData, 'FECHA') || 
                getJsonDate((f1.supplyPoint as any).jsonData, 'FECHA FIRMA') || getJsonDate((f1.supplyPoint as any).jsonData, 'FECHA') || 
                f1.fechaEmision || new Date();
    }

    if (!refDate) {
      throw new Error("Contrato sin fecha de firma. F1 requiere reparación. Imposible calcular costes regulados de referencia.");
    }

    const refRegCosts = await prisma.regulatedCost.findMany({
      where: {
        OR: [{ tariff }, { tariff: 'TODAS' }],
        validFrom: { lte: refDate },
        validTo: { gt: refDate }
      },
      orderBy: { validFrom: 'asc' }
    });

    // Extract BOE values from RegulatedCost
    let perdidasBOE: any = null;
    let fneeCostArray: any = null;
    
    let peajesEnergiaBOE: any = null;
    let cargosEnergiaBOE: any = null;
    let peajesPotenciaBOE: any = null;
    let cargosPotenciaBOE: any = null;
    let pcBOE: any = null; // Pago por capacidad
    let romBOE: any = null;
    let rosBOE: any = null;

    for (const reg of regCosts) {
      if (reg.concept === 'PERDIDAS') perdidasBOE = reg;
      else if (reg.concept === 'FNEE') fneeCostArray = reg;
      else if (reg.concept === 'PEAJES' || reg.concept === 'PEAJES_ENERGIA' || reg.concept === 'Peajes_Energia') peajesEnergiaBOE = reg;
      else if (reg.concept === 'CARGOS' || reg.concept === 'CARGOS_ENERGIA' || reg.concept === 'Cargos_Energia') cargosEnergiaBOE = reg;
      else if (reg.concept === 'PEAJES_POTENCIA' || reg.concept === 'Peajes_Potencia') peajesPotenciaBOE = reg;
      else if (reg.concept === 'CARGOS_POTENCIA' || reg.concept === 'Cargos_Potencia') cargosPotenciaBOE = reg;
      else if (reg.concept === 'CAPACIDAD' || reg.concept === 'PC' || reg.concept === 'Pagos_Capacidad') pcBOE = reg;
      else if (reg.concept === 'ROM' || reg.concept === 'Pago_OM') romBOE = reg;
      else if (reg.concept === 'ROS' || reg.concept === 'Pago_OS') rosBOE = reg;
    }

    let refPeajesEnergiaBOE: any = null;
    let refCargosEnergiaBOE: any = null;
    let refPeajesPotenciaBOE: any = null;
    let refCargosPotenciaBOE: any = null;
    let refFneeCostArray: any = null;
    let refPcBOE: any = null;
    let refRomBOE: any = null;
    let refRosBOE: any = null;

    for (const reg of refRegCosts) {
      if (reg.concept === 'PEAJES' || reg.concept === 'PEAJES_ENERGIA' || reg.concept === 'Peajes_Energia') refPeajesEnergiaBOE = reg;
      else if (reg.concept === 'CARGOS' || reg.concept === 'CARGOS_ENERGIA' || reg.concept === 'Cargos_Energia') refCargosEnergiaBOE = reg;
      else if (reg.concept === 'PEAJES_POTENCIA' || reg.concept === 'Peajes_Potencia') refPeajesPotenciaBOE = reg;
      else if (reg.concept === 'CARGOS_POTENCIA' || reg.concept === 'Cargos_Potencia') refCargosPotenciaBOE = reg;
      else if (reg.concept === 'FNEE') refFneeCostArray = reg;
      else if (reg.concept === 'CAPACIDAD' || reg.concept === 'PC' || reg.concept === 'Pagos_Capacidad') refPcBOE = reg;
      else if (reg.concept === 'ROM' || reg.concept === 'Pago_OM') refRomBOE = reg;
      else if (reg.concept === 'ROS' || reg.concept === 'Pago_OS') refRosBOE = reg;
    }

    // Se movió la validación más abajo, donde isFixed ya está definido

    const getRegVal = (reg: any, p: string): number => {
      if (!reg) return 0;
      if (reg.singleValue !== null) return reg.singleValue;
      return (reg as any)[p.toLowerCase()] || 0;
    };

    let airData: any = null;
    if ((contract as any).airtableData) {
      airData = typeof (contract as any).airtableData === 'string' 
        ? JSON.parse((contract as any).airtableData) 
        : (contract as any).airtableData;
    }
    const getAirVal = (key: string) => {
      if (!airData) return 0;
      return Number(airData[key] || airData[`${key} (from PRODUCTOS)`] || airData[`PRECIO ${key}`]) || 0;
    };

    const prodType = (contract as any).product?.type?.toLowerCase() || '';
    const prodName = (contract as any).product?.name?.toUpperCase() || '';
    let isFixed = false;
    const pm = contract.pricingModel?.toUpperCase() || '';
    
    // 1. Explicit pricingModel on contract
    if (pm === 'FIJO' || pm === 'FIXED') {
      isFixed = true;
    } else if (pm === 'INDEXADO' || pm === 'INDEX' || pm === 'INDEXED') {
      isFixed = false;
    }
    // 2. Fallback to product type string
    else if (prodType.includes('index') || prodType.includes('pass-through')) {
      isFixed = false;
    } else if (prodType.includes('fijo')) {
      isFixed = true;
    }
    // 3. Fallback to Airtable legacy
    else {
      const airFijo = airData && typeof airData['FIJO / INDEX'] === 'string' ? airData['FIJO / INDEX'].toUpperCase() : '';
      isFixed = (airFijo === 'F' || airFijo === 'FIJO');
    }
    
    // VALIDATION: Throw a mismatch flag if historical BOE is missing
    if (isFixed) {
       if (!refPeajesEnergiaBOE || !refCargosEnergiaBOE) {
          hasMismatch = true;
          originalMismatchReason = originalMismatchReason ? originalMismatchReason + ` | Faltan peajes históricos para la fecha de firma o referencia (${refDate.toISOString().substring(0, 10)}). Actualice la base de datos de Costes Regulados.` : `Faltan peajes históricos para la fecha de firma o referencia (${refDate.toISOString().substring(0, 10)}). Actualice la base de datos de Costes Regulados.`;
       }
    }
    
    let feeValue = contract.fee;
    if (feeValue === null || feeValue === undefined) {
      feeValue = getAirVal('FEE_P') || getAirVal('FEE Index Personalizado') || getAirVal('FEE');
    }
    if (!isFixed && (feeValue === undefined || feeValue === null)) {
      hasMismatch = true;
      originalMismatchReason = originalMismatchReason ? originalMismatchReason + " | Contrato Indexado sin Margen de Comercialización (FEE) configurado." : "Contrato Indexado sin Margen de Comercialización (FEE) configurado.";
      feeValue = 0;
    }
    if (!isFixed && (contract.deviationCost === null || contract.deviationCost === undefined)) {
      hasMismatch = true;
      originalMismatchReason = originalMismatchReason ? originalMismatchReason + " | Contrato Indexado sin coste de desvíos (DSV) configurado." : "Contrato Indexado sin coste de desvíos (DSV) configurado.";
    }

    const periodsBreakdown: Record<string, BillingPeriodBreakdown> = {
      P1: { period: 'P1', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P1']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P2: { period: 'P2', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P2']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P3: { period: 'P3', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P3']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P4: { period: 'P4', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P4']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P5: { period: 'P5', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P5']||0, energyCostEur: 0, regulatedCostEur: 0 },
      P6: { period: 'P6', cchConsumptionMWh: 0, f1ConsumptionMWh: f1VolumesByPeriod['P6']||0, energyCostEur: 0, regulatedCostEur: 0 }
    };

    // Variables for shadow pricing
    let totalShadowIndexedCost = 0;
    let totalEnergyCost = 0;
    let totalPeajesEnergiaBOE = 0;
    let totalCargosEnergiaBOE = 0;
    let totalFneeCostEur = 0;
    let totalF1MWhCalc = 0;
    
    const hourlyDetails: any[] = [];

    for (const hData of cchHourlyMWh) {
      // Use Madrid local time to match DB structure
      const localStr = hData.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
      const localDateKey = localStr.substring(0, 10);
      const localHour = parseInt(localStr.substring(11, 13), 10);
      const localMinute = parseInt(localStr.substring(14, 16), 10);
      const key = `${localDateKey}_${localHour}_${localMinute}`;

      const mwh = hData.mwh;

      const p = hData.period;
      if (!periodsBreakdown[p]) continue; 
      
      periodsBreakdown[p].cchConsumptionMWh += mwh;

      // Extract hourly market prices
      const omie = omieMap.get(key) ?? 0; // Default to 0 to prevent crashes, but ideally should throw if 100% strict
      
      let sumComps = 0;
      const compVals: Record<string, number> = {};
      for (const c of individualComps) {
         const v = compMaps[c].get(key) ?? 0;
         compVals[c] = v;
         sumComps += v;
      }
      
      const desvio = contract.deviationCost || 2; // Default to 2 as reference
      
      const pc = getRegVal(pcBOE, p) * 1000;
      const rom = getRegVal(romBOE, p) * 1000;
      const ros = getRegVal(rosBOE, p) * 1000;

      let fneeCost = 0;
      if (fneeCostArray && fneeCostArray.singleValue !== null) {
        fneeCost = fneeCostArray.singleValue * 1000;
      } else {
        fneeCost = getRegVal(fneeCostArray, p) * 1000;
      }

      const atrPeaje = getRegVal(peajesEnergiaBOE, p) * 1000; // Convert to €/MWh
      const atrCargo = getRegVal(cargosEnergiaBOE, p) * 1000;
      const atr = atrPeaje + atrCargo;
      
      totalPeajesEnergiaBOE += (atrPeaje * mwh);
      totalCargosEnergiaBOE += (atrCargo * mwh);

      // Calculation of losses
      let pctPerd = 0;
      if (perdidasBOE) {
        const pVal = getRegVal(perdidasBOE, p);
        const k = kMap.get(key) || 1;
        pctPerd = pVal * k;
      } else {
        pctPerd = perdMap.get(key) ?? 0;
      }
      if (Math.abs(pctPerd) > 2.0) pctPerd /= 100.0;
      const lossFactor = 1 + pctPerd;

      // Formula: Ph = [[(OMIEh + sumComps + PC + ROM + ROS + DSV)*(1+Perd) + FNEE + FEE] * 1/0,985]
      
      const shadowBase = (omie + sumComps + pc + rom + ros + 2 /* DSV shadow */) * lossFactor;
      const shadowPh = (shadowBase + fneeCost + 0 /* FEE shadow */) * (1 / 0.985);
      totalShadowIndexedCost += shadowPh * mwh;
      totalFneeCostEur += (fneeCost * mwh);

      let ph = 0;
      let hCost = 0;

      if (isFixed) {
        const pNum = parseInt(p.replace('P', '')) || 1;
        let fixedPrice = (contract as any)[`p${pNum}e`];
        if (fixedPrice !== null && fixedPrice !== undefined && fixedPrice < 5) fixedPrice *= 1000;
        if (!fixedPrice) fixedPrice = (getAirVal(`P${pNum}E`) || getAirVal(`P${pNum} E`)) * 1000;
        if (!fixedPrice) fixedPrice = 0;
        
        const refAtrPeaje = getRegVal(refPeajesEnergiaBOE, p) * 1000;
        const refAtrCargo = getRegVal(refCargosEnergiaBOE, p) * 1000;
        const refAtr = refAtrPeaje + refAtrCargo;
        
        const marginPh = fixedPrice - refAtr;
        ph = marginPh;
        
        hCost = ph * mwh;
        // Do NOT add to totalEnergyCost inside the hourly loop for FIXED pricing.
        // It will be calculated per-period at the end using F1 volumes.
      } else {
        const dsv = contract.deviationCost || 0;
        const base = (omie + sumComps + pc + rom + ros + dsv) * lossFactor;
        ph = (base + fneeCost + feeValue) * (1 / 0.985);
        hCost = ph * mwh;
        
        totalEnergyCost += hCost;
        periodsBreakdown[p].energyCostEur += hCost;
      }
      
      periodsBreakdown[p].regulatedCostEur += (atr * mwh);

      if (returnHourlyDetails) {
        hourlyDetails.push({
          date: hData.date.toISOString(),
          period: p,
          mwh,
          omie,
          sumComps,
          compVals,
        dsv: contract.deviationCost || 0,
        pc,
        rom,
        ros,
        k: kMap.get(key) || 1,
        perdBase: perdidasBOE ? getRegVal(perdidasBOE, p) : 0,
        pctPerd,
        lossFactor,
        atr,
        fnee: fneeCost,
        fee: feeValue,
        ph,
        hCost
      });
      }
    }

    // Power Term
    const billingDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    
    const p1c = contract.p1c ?? f1.supplyPoint.p1c ?? getAirVal('P1C') ?? 0;
    const p2c = contract.p2c ?? f1.supplyPoint.p2c ?? getAirVal('P2C') ?? 0;
    const p3c = contract.p3c ?? f1.supplyPoint.p3c ?? getAirVal('P3C') ?? 0;
    const p4c = contract.p4c ?? f1.supplyPoint.p4c ?? getAirVal('P4C') ?? 0;
    const p5c = contract.p5c ?? f1.supplyPoint.p5c ?? getAirVal('P5C') ?? 0;
    const p6c = contract.p6c ?? f1.supplyPoint.p6c ?? getAirVal('P6C') ?? 0;

    // ALERTA DE DISCREPANCIA EN POTENCIAS CONTRATADAS F1 VS CONTRATO ERP
    const sumBilledPower = (p1c || 0) + (p2c || 0) + (p3c || 0) + (p4c || 0) + (p5c || 0) + (p6c || 0);
    let sumF1ContractedPower = 0;
    const termMaxForAlert = getArray((f1.jsonData as any)?.Potencias?.TerminosPotencia || (f1.jsonData as any)?.Potencia?.TerminoPotencia);
    const pMaxForAlert = termMaxForAlert.flatMap((t: any) => getArray(t?.Periodo));
    if (pMaxForAlert && pMaxForAlert.length > 0) {
      for (const p of pMaxForAlert) {
        let pot = parseFloat((p.PotenciaContratada || p.potenciaContratada || '0').toString().replace(',', '.'));
        if (pot > 1000) pot = pot / 1000.0;
        sumF1ContractedPower += pot;
      }
    }
    
    if (sumF1ContractedPower > 0 && Math.abs(sumF1ContractedPower - sumBilledPower) > 0.1) {
      hasMismatch = true;
      const discrepancyAlert = `Descuadre de potencia: El F1 indica una suma de potencias contratadas de ${sumF1ContractedPower.toFixed(3)} kW, pero el contrato del ERP suma ${sumBilledPower.toFixed(3)} kW.`;
      originalMismatchReason = originalMismatchReason ? originalMismatchReason + " | " + discrepancyAlert : discrepancyAlert;
    }

    const baseP1p = contract.p1p || getAirVal('P1P') || getAirVal('P1 P');
    if (!baseP1p) throw new Error("Contrato sin precio de Término de Potencia (P1P) configurado.");
    
    const p1p = baseP1p;
    const p2p = contract.p2p || getAirVal('P2P') || getAirVal('P2 P') || p1p;
    const p3p = contract.p3p || getAirVal('P3P') || getAirVal('P3 P') || p1p;
    const p4p = contract.p4p || getAirVal('P4P') || getAirVal('P4 P') || p1p;
    const p5p = contract.p5p || getAirVal('P5P') || getAirVal('P5 P') || p1p;
    const p6p = contract.p6p || getAirVal('P6P') || getAirVal('P6 P') || p1p;

    const isYearlyPower = p1p > 2; // Si es mayor de 2€, asumimos €/kW/año
    const daysMultiplier = isYearlyPower ? (billingDays / 365.0) : billingDays;

    const powerDetails: any[] = [];
    let powerCost = 0;
    let boePowerCost = 0;
    
    const processPower = (period: string, kw: number, price: number) => {
      if (!kw || !price) return;
      
      const refAtrPeajeP = getRegVal(refPeajesPotenciaBOE, period);
      const refAtrCargoP = getRegVal(refCargosPotenciaBOE, period);
      const refAtrP = refAtrPeajeP + refAtrCargoP;
      
      const atrPeajeP = getRegVal(peajesPotenciaBOE, period);
      const atrCargoP = getRegVal(cargosPotenciaBOE, period);
      const currentAtrP = atrPeajeP + atrCargoP;
      
      const margin = price - refAtrP;
      const billedPrice = margin + currentAtrP;
      
      const billed = kw * billedPrice * daysMultiplier;
      powerCost += billed;
      powerDetails.push({ period, kw, days: billingDays, price: billedPrice, total: billed, peajeEur: kw * atrPeajeP * daysMultiplier, cargoEur: kw * atrCargoP * daysMultiplier });
      
      // BOE Power cost (reference to calculate theoretical margin)
      boePowerCost += kw * currentAtrP * daysMultiplier;
    };

    processPower('P1', p1c, p1p);
    processPower('P2', p2c, p2p);
    processPower('P3', p3c, p3p);
    processPower('P4', p4c, p4p);
    processPower('P5', p5c, p5p);
    processPower('P6', p6c, p6p);

    // Margins
    const energyMargin = isFixed ? (totalEnergyCost - totalShadowIndexedCost) : (feeValue * totalCchMWh);
    const powerMargin = powerCost - boePowerCost;

    if (powerMargin < 0) {
      hasMismatch = true;
      originalMismatchReason = originalMismatchReason 
        ? originalMismatchReason + " | Margen de potencia negativo. Verifique precios P1P-P6P." 
        : "Margen de potencia negativo. Verifique precios P1P-P6P.";
    }

    // Alquiler
    let alquilerEquipo = 0;
    if (f1.jsonData && (f1.jsonData as any).Alquileres) {
      alquilerEquipo = Math.abs(parseFloat(((f1.jsonData as any).Alquileres.ImporteFacturacionAlquileres || '0').toString().replace(',', '.')));
    }

    // Excesos de Potencia
    let excesosPotencia = 0;
    if (f1.jsonData && (f1.jsonData as any)['Importe Total Excesos ATR']) {
      excesosPotencia = Math.abs(parseFloat(((f1.jsonData as any)['Importe Total Excesos ATR']).toString().replace(',', '.')));
    } else if (f1.jsonData && (f1.jsonData as any)['Importe Excesos Potencia']) {
      excesosPotencia = Math.abs(parseFloat(((f1.jsonData as any)['Importe Excesos Potencia']).toString().replace(',', '.')));
    } else if (f1.jsonData && (f1.jsonData as any)['Importe Total Excesos ATR F1']) {
      excesosPotencia = Math.abs(parseFloat(((f1.jsonData as any)['Importe Total Excesos ATR F1']).toString().replace(',', '.')));
    } else if (f1.jsonData && (f1.jsonData as any).ExcesoPotencia && (f1.jsonData as any).ExcesoPotencia.ImporteTotalExcesos) {
      excesosPotencia = Math.abs(parseFloat(((f1.jsonData as any).ExcesoPotencia.ImporteTotalExcesos).toString().replace(',', '.')));
    }

    // Excedentes Autoconsumo
    let excedentesAutoconsumo = 0;
    let surplusKwhForOutput = 0;
    let pexc: number | null = contract.pexc !== undefined && contract.pexc !== null ? Number(contract.pexc) : null;
    
    if (f1.jsonData && (f1.jsonData as any)['Importe Excedentes Autoconsumo']) {
      excedentesAutoconsumo = Math.abs(parseFloat(((f1.jsonData as any)['Importe Excedentes Autoconsumo']).toString().replace(',', '.')));
    } else if (f1.jsonData && (f1.jsonData as any).Autoconsumo && (f1.jsonData as any).Autoconsumo.EnergiaExcedentaria && (f1.jsonData as any).Autoconsumo.EnergiaExcedentaria.ValorTotalEnergiaExcedentaria) {
      const surplusKwh = parseFloat(((f1.jsonData as any).Autoconsumo.EnergiaExcedentaria.ValorTotalEnergiaExcedentaria).toString().replace(',', '.'));
      surplusKwhForOutput = surplusKwh;
      const surplusMwh = surplusKwh / 1000;
      
      let feeExcedentes: number | null = contract.feeExcedentes !== undefined && contract.feeExcedentes !== null ? Number(contract.feeExcedentes) : null;
      
      if (pexc !== null && pexc > 0) {
        // Precio Fijo
        excedentesAutoconsumo = surplusMwh * pexc;
      } else if (feeExcedentes !== null) {
        // Precio Indexado
        let sumPago = 0;
        for (const hData of cchSurplusHourlyMWh) {
          const localStr = hData.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
          const key = `${localStr.substring(0, 10)}_${parseInt(localStr.substring(11, 13), 10)}_${parseInt(localStr.substring(14, 16), 10)}`;
          const omie = omieMap.get(key) ?? 0;
          const precio = Math.max(0, omie - feeExcedentes);
          sumPago += hData.mwh * precio;
          if (returnHourlyDetails) {
             // We can augment hourlyDetails later
             const hDetail = hourlyDetails.find(h => h.date === hData.date.toISOString());
             if (hDetail) {
               hDetail.surplusMwh = hData.mwh;
               hDetail.surplusPrice = precio;
               hDetail.surplusPayout = hData.mwh * precio;
             }
          }
        }
        excedentesAutoconsumo = sumPago;
        if (surplusMwh > 0) {
           pexc = sumPago / surplusMwh; // Guardar el precio medio para mostrarlo en PDF/Excel
        } else {
           pexc = 0;
        }
      } else {
        hasMismatch = true;
        originalMismatchReason = originalMismatchReason ? originalMismatchReason + " | Cliente con excedentes pero sin precio PEXC ni feeExcedentes configurado en el contrato (se aplica 0 €)." : "Cliente con excedentes pero sin precio PEXC ni feeExcedentes configurado en el contrato (se aplica 0 €).";
        pexc = 0;
        excedentesAutoconsumo = 0;
      }
    }

    // Bono Social (Orden TED/1487/2024: ~0.019121 €/día)
    const bonoSocial = billingDays * 0.019121;
    
    // For fixed pricing, re-calculate energy and ATR using period totals from F1
    if (isFixed) {
      totalEnergyCost = 0;
      totalPeajesEnergiaBOE = 0;
      totalCargosEnergiaBOE = 0;
      for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
        const b = periodsBreakdown[p];
        if (!b) continue;
        
        const f1Mwh = b.f1ConsumptionMWh;
        if (f1Mwh > 0) {
          const pNum = parseInt(p.replace('P', '')) || 1;
          let fixedPrice = (contract as any)[`p${pNum}e`];
          if (fixedPrice !== null && fixedPrice !== undefined && fixedPrice < 5) fixedPrice *= 1000;
          if (!fixedPrice) fixedPrice = (getAirVal(`P${pNum}E`) || getAirVal(`P${pNum} E`)) * 1000;
          if (!fixedPrice) {
            hasMismatch = true;
            originalMismatchReason = originalMismatchReason ? originalMismatchReason + ` | Contrato Fijo sin precio configurado para energía (${p}E).` : `Contrato Fijo sin precio configurado para energía (${p}E).`;
            fixedPrice = 0;
          }
          
          const refAtrPeaje = getRegVal(refPeajesEnergiaBOE, p) * 1000;
          const refAtrCargo = getRegVal(refCargosEnergiaBOE, p) * 1000;
          const refAtr = refAtrPeaje + refAtrCargo;
          
          const refFnee = refFneeCostArray ? getRegVal(refFneeCostArray, p) * 1000 : 0;
          const currentFnee = fneeCostArray ? getRegVal(fneeCostArray, p) * 1000 : 0;
          const diffFnee = currentFnee - refFnee;

          const refPc = refPcBOE ? getRegVal(refPcBOE, p) * 1000 : 0;
          const currentPc = pcBOE ? getRegVal(pcBOE, p) * 1000 : 0;
          const diffPc = currentPc - refPc;
          
          const refRom = refRomBOE ? getRegVal(refRomBOE, p) * 1000 : 0;
          const currentRom = romBOE ? getRegVal(romBOE, p) * 1000 : 0;
          const diffRom = currentRom - refRom;
          
          const refRos = refRosBOE ? getRegVal(refRosBOE, p) * 1000 : 0;
          const currentRos = rosBOE ? getRegVal(rosBOE, p) * 1000 : 0;
          const diffRos = currentRos - refRos;

          let marginPh = fixedPrice - refAtr;
          
          // Repercutimos al cliente las variaciones en costes del sistema (FNEE, PC, ROM, ROS)
          marginPh += diffFnee + diffPc + diffRom + diffRos;
          
          const pCost = marginPh * f1Mwh;
          
          totalEnergyCost += pCost;
          b.energyCostEur = pCost;
          
          const currentAtrPeaje = getRegVal(peajesEnergiaBOE, p) * 1000;
          const currentAtrCargo = getRegVal(cargosEnergiaBOE, p) * 1000;
          totalPeajesEnergiaBOE += currentAtrPeaje * f1Mwh;
          totalCargosEnergiaBOE += currentAtrCargo * f1Mwh;
          b.regulatedCostEur = (currentAtrPeaje + currentAtrCargo) * f1Mwh;
        } else {
          b.energyCostEur = 0;
          b.regulatedCostEur = 0;
        }
      }
    }

    // Details for PDF
    const energyAtrDetails: any[] = [];
    const energyMarketDetails: any[] = [];
    
    for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
      const b = periodsBreakdown[p];
      const mwh = isFixed && b?.f1ConsumptionMWh > 0 ? b.f1ConsumptionMWh : (b?.cchConsumptionMWh || b?.f1ConsumptionMWh || 0);
      
      if (b && mwh > 0) {
        const kwh = mwh * 1000;
        const totalEur = b.energyCostEur;
        const price = totalEur / kwh;
        
        // For the PDF, the user requested to separate the ATR part and the Market part
        const atrPeaje = getRegVal(peajesEnergiaBOE, p); // €/kWh
        const atrCargo = getRegVal(cargosEnergiaBOE, p);
        const atrTotalEur = (atrPeaje + atrCargo) * kwh;
        
        energyAtrDetails.push({ period: p, kwh, price: atrPeaje + atrCargo, total: atrTotalEur, peajeEur: atrPeaje * kwh, cargoEur: atrCargo * kwh });
        
        const marketTotalEur = totalEur;
        energyMarketDetails.push({ 
            period: p, 
            kwh, 
            price: marketTotalEur / kwh, 
            total: marketTotalEur,
            refAtr: (isFixed ? (getRegVal(refPeajesEnergiaBOE, p) + getRegVal(refCargosEnergiaBOE, p)) * 1000 : 0),
            currentAtr: getRegVal(peajesEnergiaBOE, p) * 1000 + getRegVal(cargosEnergiaBOE, p) * 1000
        });
      }
    }

    // Cálculo de Energía Reactiva (Circular 3/2020)
    let reactiveEnergyCost = 0;
    const reactiveDetails: any[] = [];
    
    // Extraer íntegramente del F1 (si existe)
    let parsedReac = NaN;
    if (f1.jsonData) {
      const termReactiva = Array.isArray((f1.jsonData as any).EnergiaReactiva?.TerminoEnergiaReactiva) 
        ? (f1.jsonData as any).EnergiaReactiva.TerminoEnergiaReactiva 
        : ((f1.jsonData as any).EnergiaReactiva?.TerminoEnergiaReactiva ? [(f1.jsonData as any).EnergiaReactiva.TerminoEnergiaReactiva] : []);
        
      let totalParsed = 0;
      let hasDetailed = false;
      
      for (const t of termReactiva) {
        const periodos = Array.isArray(t?.Periodo) ? t.Periodo : (t?.Periodo ? [t.Periodo] : []);
        for (let i = 0; i < periodos.length; i++) {
          const p = periodos[i];
          const pNameRaw = Array.isArray(p.Periodo) ? p.Periodo[0] : (p.Periodo || p.periodo || '');
          let pName = typeof pNameRaw === 'string' ? pNameRaw.trim() : (pNameRaw ? pNameRaw.toString().trim() : '');
          
          if (!pName && periodos.length === 6) {
            pName = `P${i + 1}`;
          }
          
          if (!pName) continue;
          
          const pFormated = pName.startsWith('P') ? pName : `P${pName}`;
          
          const rawCost = p.ImporteTerminoEnergiaReactiva || p.importeTerminoEnergiaReactiva || p.ImporteTotalEnergiaReactiva;
          const costStr = Array.isArray(rawCost) ? rawCost[0] : rawCost;
          let cost = costStr ? parseFloat(costStr.toString().replace(',', '.')) : 0;
          
          const rawKvarh = p.ValorEnergiaReactiva || p.valorEnergiaReactiva || p.EnergiaReactivaTotal || p.energiaReactivaTotal;
          const kvarhStr = Array.isArray(rawKvarh) ? rawKvarh[0] : rawKvarh;
          const kvarh = kvarhStr ? parseFloat(kvarhStr.toString().replace(',', '.')) : 0;
          
          if (cost === 0 && kvarh > 0 && p.PrecioEnergiaReactiva) {
             const rawPrice = Array.isArray(p.PrecioEnergiaReactiva) ? p.PrecioEnergiaReactiva[0] : p.PrecioEnergiaReactiva;
             const price = parseFloat(rawPrice.toString().replace(',', '.'));
             if (!isNaN(price)) cost = kvarh * price;
          }
          
          if (!isNaN(cost) && cost > 0) {
            reactiveDetails.push({ period: pFormated, cost: cost, kvarh: kvarh, excessKvarh: 0 });
            totalParsed += cost;
            hasDetailed = true;
          }
        }
      }

      if (hasDetailed) {
        parsedReac = totalParsed;
      } else {
        if ((f1.jsonData as any)['Importe Total Energia Reactiva']) {
          parsedReac = parseFloat((f1.jsonData as any)['Importe Total Energia Reactiva']);
        } else if ((f1.jsonData as any)['ImporteTotalRAtr']) {
          parsedReac = parseFloat((f1.jsonData as any)['ImporteTotalRAtr']);
        } else if ((f1.jsonData as any)['Importe Total RAtr']) {
          parsedReac = parseFloat((f1.jsonData as any)['Importe Total RAtr']);
        } else if ((f1.jsonData as any).EnergiaReactiva) {
          const er = (f1.jsonData as any).EnergiaReactiva;
          const val = Array.isArray(er) ? er[0]?.ImporteTotalEnergiaReactiva : er.ImporteTotalEnergiaReactiva;
          if (val) {
            parsedReac = parseFloat(Array.isArray(val) ? val[0] : (val?._ || val));
          }
        }
      }
    }

    if (!isNaN(parsedReac) && parsedReac > 0) {
      reactiveEnergyCost = parsedReac;
      if (reactiveDetails.length === 0) {
        reactiveDetails.push({ period: 'TOTAL', cost: reactiveEnergyCost, kvarh: 0, excessKvarh: 0 });
      }
    } else {
      // Fallback a cálculo de Circular 3/2020
      let fallbackTriggered = false;
      if (tariff && tariff !== '2.0TD') {
        for (const p of ['P1', 'P2', 'P3', 'P4', 'P5']) { // P6 está exento
          const actCons = f1Readings[p]?.actCons || 0;
          const reactCons = f1Readings[p]?.reactCons || 0;
          
          if (actCons > 0 && reactCons > 0) {
            const limit33 = actCons * 0.33;
            const limit75 = actCons * 0.75;
            
            if (reactCons > limit33) {
              let cost = 0;
              const excessTier1 = Math.min(reactCons, limit75) - limit33;
              if (excessTier1 > 0) {
                cost += excessTier1 * 0.041554;
              }
              if (reactCons > limit75) {
                const excessTier2 = reactCons - limit75;
                cost += excessTier2 * 0.062332;
              }
              
              if (cost > 0) {
                fallbackTriggered = true;
                reactiveEnergyCost += cost;
                reactiveDetails.push({
                  period: p,
                  kvarh: reactCons,
                  excessKvarh: reactCons - limit33,
                  cost: cost
                });
              }
            }
          }
        }
      }
      if (fallbackTriggered) {
        hasMismatch = true;
        originalMismatchReason = originalMismatchReason 
          ? originalMismatchReason + " | La distribuidora no ha repercutido penalización por reactiva, pero ha sido facturada al cliente por exceso físico (Fallback Circular 3/2020)."
          : "La distribuidora no ha repercutido penalización por reactiva, pero ha sido facturada al cliente por exceso físico (Fallback Circular 3/2020).";
      }
    }

    // Límite de Excedentes según RD 244/2019 (Suma del Término de Energía Activa + Margen de Potencia)
    let maxExcedentes = 0;
    if (energyMarketDetails.length > 0) {
      maxExcedentes = energyMarketDetails.reduce((acc, detail) => acc + detail.total, 0);
    }
    maxExcedentes += Math.max(0, powerMargin);
    
    let bolsilloSolarLlenado = 0;
    if (excedentesAutoconsumo > maxExcedentes) {
        bolsilloSolarLlenado = excedentesAutoconsumo - maxExcedentes;
        excedentesAutoconsumo = maxExcedentes;
    }

    // Base imponible includes everything. Excedentes are deducted BEFORE IE according to standard practice.
    let totalBase = totalEnergyCost + totalPeajesEnergiaBOE + totalCargosEnergiaBOE + powerCost + excesosPotencia + reactiveEnergyCost - excedentesAutoconsumo;

    // Impuesto Eléctrico (IEE) applies only to energy, power, and excesos/excedentes. 
    // It does NOT apply to Alquiler de Equipo nor Bono Social.
    const ieeRate = (contract as any).taxElectric !== undefined && (contract as any).taxElectric !== null ? Number((contract as any).taxElectric) : 5.11269;
    
    let taxElectric = 0;
    // Regla de Negocio: Si no hay consumo de energía activa, el impuesto eléctrico a facturar es cero.
    if (totalF1MWh > 0) {
      taxElectric = totalBase * (ieeRate / 100.0);
      // Mínimo de 1 €/MWh para tarifas 2.0TD y 3.0TD y 0,5 €/MWh para el resto
      const minTaxRate = (tariff === '2.0TD' || tariff === '3.0TD') ? 1.0 : 0.5;
      const minTaxAmount = totalF1MWh * minTaxRate;
      if (taxElectric < minTaxAmount) {
        taxElectric = minTaxAmount;
      }
    }
    
    // Calculate SVA (Servicios de Valor Añadido)
    let svaCost = 0;
    let svaConcept = '';
    const contractAny = contract as any;
    if (contractAny.svaPrice && contractAny.svaDuration) {
      const tSva = contractAny.svaStartDate ? new Date(contractAny.svaStartDate).getTime() : 0;
      const tAct = contractAny.activationDate ? new Date(contractAny.activationDate).getTime() : 0;
      const tSig = contractAny.signatureDate ? new Date(contractAny.signatureDate).getTime() : 0;
      
      let baseStart = tSva > 0 ? tSva : (tAct > 0 ? tAct : tSig);
      if (tSva > 0 && tAct > 0) {
        baseStart = Math.max(tSva, tAct);
      }
      
      if (baseStart > 0) {
        const actualSvaStart = new Date(baseStart);
        const actualSvaEnd = new Date(baseStart);
        actualSvaEnd.setMonth(actualSvaEnd.getMonth() + contractAny.svaDuration);

        const overlapStart = new Date(Math.max(startDate.getTime(), actualSvaStart.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), actualSvaEnd.getTime()));

        let overlapDays = 0;
        if (overlapEnd > overlapStart) {
          overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 3600 * 24);
        }

        if (overlapDays > 0) {
          const svaMonthlyPrice = contractAny.svaPrice / contractAny.svaDuration;
          const svaDailyPrice = (svaMonthlyPrice * 12) / 365;
          svaCost = svaDailyPrice * overlapDays;
          svaConcept = contractAny.svaConcept || 'SVA';
        }
      } else {
        // Fallback legado si no hay fechas
        const svaMonthlyPrice = contractAny.svaPrice / contractAny.svaDuration;
        const svaDailyPrice = (svaMonthlyPrice * 12) / 365;
        svaCost = svaDailyPrice * billingDays;
        svaConcept = contractAny.svaConcept || 'SVA';
      }
    }

    // Now add the non-taxable components to the final total base
    totalBase += taxElectric + alquilerEquipo + bonoSocial + svaCost;

    const taxAmount = totalBase * 0.21; // IVA 21%
    const totalAmount = totalBase + taxAmount;

    const result: any = {
      hasMismatch,
      mismatchReason,
      totalCchMWh,
      totalF1MWh,
      periods: periodsBreakdown,
      energyCost: totalEnergyCost,
      feeCost: feeValue * totalCchMWh,
      capacityCost: 0,
      fneeCost: totalFneeCostEur,
      reactiveEnergyCost: reactiveEnergyCost,
      powerCost,
      peajesDistribuidora: totalPeajesEnergiaBOE, // Informational
      cargosDistribuidora: totalCargosEnergiaBOE, // Informational
      alquilerEquipo,
      bonoSocial,
      taxElectric,
      svaCost,
      svaConcept,
      excesosPotencia,
      excedentesAutoconsumo,
      excedentesKwh: surplusKwhForOutput,
      pexc,
      maxExcedentes,
      bolsilloSolarLlenado,
      totalBase,
      taxAmount,
      totalAmount,
      isFixed,
      powerDetails,
      energyAtrDetails,
      energyMarketDetails,
      energyMargin,
      f1Readings,
      powerMargin,
      hourlyDetails,
      reactiveDetails,
      repairData: originalMismatchReason ? { issue: originalMismatchReason, f1Volume: totalF1MWh, cchVolume: originalCchMWh } : null
    };

    if (isAbono) {
      const invert = (val: number | undefined) => val !== undefined && val !== null ? -val : undefined;
      result.totalAmount = invert(result.totalAmount) as number;
      result.totalBase = invert(result.totalBase) as number;
      result.taxAmount = invert(result.taxAmount) as number;
      result.powerMargin = invert(result.powerMargin) as number;
      result.energyMargin = invert(result.energyMargin) as number;
      result.energyCost = invert(result.energyCost) as number;
      result.feeCost = invert(result.feeCost) as number;
      result.capacityCost = invert(result.capacityCost) as number;
      result.fneeCost = invert(result.fneeCost) as number;
      result.bonoSocial = invert(result.bonoSocial) as number;
      result.peajesDistribuidora = invert(result.peajesDistribuidora) as number;
      result.cargosDistribuidora = invert(result.cargosDistribuidora) as number;
      result.alquilerEquipo = invert(result.alquilerEquipo);
      result.taxElectric = invert(result.taxElectric);
      result.excesosPotencia = invert(result.excesosPotencia);
      result.excedentesAutoconsumo = invert(result.excedentesAutoconsumo);
      result.powerCost = invert(result.powerCost) as number;
      result.reactiveEnergyCost = invert(result.reactiveEnergyCost) as number;
      result.maxExcedentes = invert(result.maxExcedentes);
      result.bolsilloSolarLlenado = invert(result.bolsilloSolarLlenado);
      result.totalBase = invert(result.totalBase);
      
      // Invert volumes for UI
      result.totalF1MWh = invert(result.totalF1MWh) as number;
      result.totalCchMWh = invert(result.totalCchMWh) as number;
      
      if (result.repairData) {
        result.repairData.f1Volume = invert(result.repairData.f1Volume);
        result.repairData.cchVolume = invert(result.repairData.cchVolume);
      }
      
      if (result.periods) {
        for (const p in result.periods) {
          result.periods[p].energyCostEur = invert(result.periods[p].energyCostEur);
          result.periods[p].regulatedCostEur = invert(result.periods[p].regulatedCostEur);
        }
      }
      if (result.hourlyDetails) {
        for (const h of result.hourlyDetails) {
          h.omieCost = invert(h.omieCost);
          h.regulatedCost = invert(h.regulatedCost);
          h.totalCost = invert(h.totalCost);
          h.fnee = invert(h.fnee);
        }
      }
      if (result.energyMarketDetails) {
        for (const m of result.energyMarketDetails) {
          m.total = invert(m.total) as number;
        }
      }
      if (result.energyAtrDetails) {
        for (const m of result.energyAtrDetails) {
          m.total = invert(m.total) as number;
          m.cargoEur = invert(m.cargoEur) as number;
          m.peajeEur = invert(m.peajeEur) as number;
        }
      }
      if (result.powerDetails) {
        for (const m of result.powerDetails) {
          m.total = invert(m.total) as number;
          m.cargoEur = invert(m.cargoEur) as number;
          m.peajeEur = invert(m.peajeEur) as number;
        }
      }
    }

    return result as BillingCalculationResult;
  }
}
