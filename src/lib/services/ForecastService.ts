import { prisma } from '../prisma';
import { getProvinceGeo, PROVINCES_GEO } from './ProvinceService';
import { addDays, getDay, getMonth, format, subDays, startOfDay, isWeekend } from 'date-fns';
import { DecisionTreeRegression } from 'ml-cart';

const SEGMENTS = ['HOGAR 0-5kW', 'HOGAR 5-10kW', 'HOGAR 10-15kW', 'PYME <50 MWh', 'PYME >50 MWh', 'VE <15 MWh', 'VE >15 MWh', 'VIP'];
const PROVINCES = Object.values(PROVINCES_GEO).map(p => p.name);

// We fetch tomorrow's weather from Open-Meteo
async function fetchForecastWeather(lat: number, lon: number, targetDate: string): Promise<number[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&timezone=Europe/Madrid&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
    const data = await res.json();
    
    const times: string[] = data.hourly.time;
    const temps: number[] = data.hourly.temperature_2m;
    
    const result: number[] = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i].startsWith(targetDate)) {
        result.push(temps[i]);
      }
    }
    
    if (result.length < 24) {
      while(result.length < 24) result.push(20.0);
    }
    
    return result;
  } catch (e) {
    console.error('Error fetching forecast weather:', e);
    return new Array(24).fill(20.0);
  }
}

export async function generateTomorrowForecast() {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
  
  console.log(`Generating forecast for ${tomorrowStr}...`);

  const activeContracts = await prisma.contract.findMany({
    where: { status: 'ACTIVO' },
    include: { supplyPoint: true }
  });

  const currentClients: Record<string, number> = {};
  const vipVeContracts = [];

  for (const c of activeContracts) {
    if (!c.supplyPoint || !c.supplyPoint.segment) continue;
    
    const segment = c.supplyPoint.segment;
    if (['VIP', 'VE <15 MWh', 'VE >15 MWh'].includes(segment)) {
      vipVeContracts.push(c);
      continue;
    }

    // Elevación a barras de central (Pérdidas)
    const tariff = c.supplyPoint.tariff || '';
    const lossFactor = tariff.includes('6.1TD') ? 1.08 : 1.17;

    const prov = getProvinceGeo(c.supplyPoint.postalCode).name;
    const key = `${segment}|${prov}`;
    currentClients[key] = (currentClients[key] || 0) + lossFactor;
  }

  // 1. Load Pre-trained AI Model from Database
  const cachedModel = await prisma.forecastModelCache.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  let regression: DecisionTreeRegression | null = null;
  if (cachedModel && cachedModel.modelData) {
    try {
      // @ts-ignore
      regression = DecisionTreeRegression.load(cachedModel.modelData);
      console.log('Successfully loaded AI model from DB cache.');
    } catch (e) {
      console.error('Failed to load AI model from cache:', e);
    }
  }

  const finalPrediction: number[] = new Array(24).fill(0);
  const vipPredictions: number[] = new Array(24).fill(0);
  const weatherCache: Record<string, number[]> = {};
  const segmentBreakdown: Record<string, number[]> = {};
  for (const s of SEGMENTS) segmentBreakdown[s] = new Array(24).fill(0);

  // Fetch all required weather forecasts concurrently
  const neededProvinces = Array.from(new Set(Object.keys(currentClients).map(k => k.split('|')[1])));
  await Promise.all(neededProvinces.map(async (province) => {
    const provName = Object.values(PROVINCES_GEO).find(p => p.name === province);
    const lat = provName ? provName.lat : 40.4165;
    const lon = provName ? provName.lon : -3.7026;
    weatherCache[province] = await fetchForecastWeather(lat, lon, tomorrowStr);
  }));

  // --- 2. CÁLCULO INDIVIDUAL SDA PARA VIP/VE ---
  if (vipVeContracts.length > 0) {
    const targetDayOfWeek = getDay(tomorrow);
    
    const cupsList = vipVeContracts.map(c => {
      const cups = c.supplyPoint?.cups || '';
      return cups.length >= 20 ? cups.substring(0, 20) : cups;
    }).filter(Boolean);

    if (cupsList.length > 0) {
      // Obtenemos los últimos 60 registros por CUPS
      const curves: any[] = await prisma.$queryRaw`
        SELECT cups, date, readings 
        FROM (
          SELECT cups, date, readings, ROW_NUMBER() OVER(PARTITION BY cups ORDER BY date DESC) as rn
          FROM "LoadCurve"
          WHERE cups = ANY(string_to_array(${cupsList.join(',')}, ','))
        ) t
        WHERE rn <= 60
      `;

      const curvesByCups: Record<string, any[]> = {};
      for (const row of curves) {
        if (!curvesByCups[row.cups]) curvesByCups[row.cups] = [];
        curvesByCups[row.cups].push(row);
      }

      for (const c of vipVeContracts) {
        const cups = c.supplyPoint?.cups || '';
        const baseCups = cups.length >= 20 ? cups.substring(0, 20) : cups;
        const tariff = c.supplyPoint?.tariff || '';
        const lossFactor = tariff.includes('6.1TD') ? 1.08 : 1.17;
        
        const history = curvesByCups[baseCups] || [];
        const similarDays = history.filter(r => getDay(new Date(r.date)) === targetDayOfWeek).slice(0, 3);

        if (similarDays.length > 0) {
          for (let h = 0; h < 24; h++) {
            let sum = 0;
            for (const d of similarDays) {
              if (d.readings && d.readings.length === 96) {
                sum += (d.readings[h * 4] + d.readings[h * 4 + 1] + d.readings[h * 4 + 2] + d.readings[h * 4 + 3]);
              } else if (d.readings && d.readings.length >= 24) {
                sum += d.readings[h];
              }
            }
            const avgHour = sum / similarDays.length;
            const finalVal = avgHour * lossFactor;
            vipPredictions[h] += finalVal;
            finalPrediction[h] += finalVal;
            const segKey = c.supplyPoint?.segment || 'VIP';
            if (segmentBreakdown[segKey]) segmentBreakdown[segKey][h] += finalVal;
          }
        }
      }
    }
  }

  // --- 3. CÁLCULO IA PARA HOGARES Y PYMES ---
  if (regression) {
    for (const [key, activeCount] of Object.entries(currentClients)) {
      if (activeCount === 0) continue; 
      
      const [segment, province] = key.split('|');

      const tomorrowTemps = weatherCache[province] || new Array(24).fill(20.0);
      const tDow = getDay(tomorrow);
      const tMonth = getMonth(tomorrow);
      const tIsWknd = isWeekend(tomorrow) ? 1 : 0;
      
      const segmentId = SEGMENTS.indexOf(segment);
      const provinceId = PROVINCES.indexOf(province);

      const X_test: number[][] = [];
      for (let h = 0; h < 24; h++) {
        X_test.push([segmentId, provinceId, tDow, tMonth, h, tomorrowTemps[h], tIsWknd]);
      }

      const Y_pred = regression.predict(X_test);

      for (let h = 0; h < 24; h++) {
        const clusterPrediction = Math.max(0, Y_pred[h]) * activeCount;
        finalPrediction[h] += clusterPrediction;
        if (segmentBreakdown[segment]) segmentBreakdown[segment][h] += clusterPrediction;
      }
    }
  }

  const totalPred = finalPrediction.reduce((a, b) => a + b, 0);
  
  await prisma.demandForecast.create({
    data: {
      targetDate: tomorrow,
      forecastData: finalPrediction,
      totalPredicted: totalPred,
      vipOverride: null 
    }
  });

  return { targetDate: tomorrowStr, finalPrediction, totalPredicted: totalPred, vipPredictions, segmentBreakdown };
}
