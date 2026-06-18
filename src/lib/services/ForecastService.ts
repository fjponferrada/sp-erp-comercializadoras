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
  for (const c of activeContracts) {
    if (!c.supplyPoint || !c.supplyPoint.segment) continue;
    const prov = getProvinceGeo(c.supplyPoint.postalCode).name;
    const key = `${c.supplyPoint.segment}|${prov}`;
    currentClients[key] = (currentClients[key] || 0) + 1;
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
  const weatherCache: Record<string, number[]> = {};
  const vipPredictions: number[] = new Array(24).fill(0);

  // VIP clusters still need recent historical data to calculate similar days.
  // We only need the last 30 days for VIP calculations.
  const history = await prisma.aggregatedLoadCurve.findMany({
    where: {
      segment: 'VIP',
      date: {
        gte: subDays(new Date(), 30)
      }
    }
  });

  const historyByCluster: Record<string, typeof history> = {};
  for (const h of history) {
    const key = `${h.segment}|${h.province}`;
    if (!historyByCluster[key]) historyByCluster[key] = [];
    historyByCluster[key].push(h);
  }

  // Fetch all required weather forecasts concurrently to avoid sequential timeouts
  const neededProvinces = Array.from(new Set(Object.keys(currentClients).map(k => k.split('|')[1])));
  await Promise.all(neededProvinces.map(async (province) => {
    const provName = Object.values(PROVINCES_GEO).find(p => p.name === province);
    const lat = provName ? provName.lat : 40.4165;
    const lon = provName ? provName.lon : -3.7026;
    weatherCache[province] = await fetchForecastWeather(lat, lon, tomorrowStr);
  }));

  for (const [key, activeCount] of Object.entries(currentClients)) {
    if (activeCount === 0) continue; 
    
    const [segment, province] = key.split('|');

    if (segment === 'VIP') {
      const records = historyByCluster[key] || [];
      const targetDayOfWeek = getDay(tomorrow);
      const similarDays = records.filter(r => getDay(r.date) === targetDayOfWeek).slice(-3);
      
      if (similarDays.length > 0) {
        for (let h = 0; h < 24; h++) {
          let sum = 0;
          for (const d of similarDays) {
            sum += (d.totalConsumption[h] / d.clientCount);
          }
          const avgPerClient = sum / similarDays.length;
          vipPredictions[h] += avgPerClient * activeCount;
          finalPrediction[h] += avgPerClient * activeCount;
        }
      }
      continue;
    }

    if (!regression) continue;

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

  return { targetDate: tomorrowStr, finalPrediction, totalPredicted: totalPred, vipPredictions };
}
