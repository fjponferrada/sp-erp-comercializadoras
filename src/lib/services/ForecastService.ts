import { prisma } from '../prisma';
import { getProvinceGeo, PROVINCES_GEO } from './ProvinceService';
import { addDays, getDay, getMonth, format, subDays, startOfDay, isWeekend } from 'date-fns';
import { RandomForestRegression as RFRegression } from 'ml-random-forest';

const SEGMENTS = ['HOGAR 0-5kW', 'HOGAR 5-10kW', 'HOGAR 10-15kW', 'PYME <50 MWh', 'VE <15 MWh', 'VIP'];
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

  // Find max date in DB to get the latest 365 days available
  const maxAgg = await prisma.aggregatedLoadCurve.aggregate({ _max: { date: true } });
  let dbMaxDate = maxAgg._max.date || new Date();
  
  // Fetch 12 months of historical data
  const history = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: {
        gte: subDays(dbMaxDate, 365)
      }
    }
  });

  const finalPrediction: number[] = new Array(24).fill(0);
  const weatherCache: Record<string, number[]> = {};
  const vipPredictions: number[] = new Array(24).fill(0);

  // 1. Prepare Global Dataset for the AI Model
  let X_global: number[][] = [];
  let Y_global: number[] = [];

  for (const record of history) {
    if (record.segment === 'VIP') continue; // VIP is handled via SDA
    if (record.clientCount === 0) continue;

    const segmentId = SEGMENTS.indexOf(record.segment);
    const provinceId = PROVINCES.indexOf(record.province);
    
    const d = record.date;
    const dow = getDay(d);
    const month = getMonth(d);
    const isWknd = isWeekend(d) ? 1 : 0;

    for (let h = 0; h < 24; h++) {
      const temp = record.temperature[h] ?? 20.0;
      const cons = record.totalConsumption[h] ?? 0;
      // Global Features: [Segment, Province, DayOfWeek, Month, Hour, Temp, isWeekend]
      X_global.push([segmentId, provinceId, dow, month, h, temp, isWknd]);
      Y_global.push(cons / record.clientCount);
    }
  }

  // Optimize training for serverless environment by down-sampling 
  // if dataset exceeds 50,000 points (to keep Vercel execution < 10s)
  const MAX_TRAINING_SAMPLES = 50000;
  if (X_global.length > MAX_TRAINING_SAMPLES) {
    const sampledX: number[][] = [];
    const sampledY: number[] = [];
    for (let i = 0; i < MAX_TRAINING_SAMPLES; i++) {
      const randIdx = Math.floor(Math.random() * X_global.length);
      sampledX.push(X_global[randIdx]);
      sampledY.push(Y_global[randIdx]);
      // Remove to avoid duplicates (swap with last element for O(1) removal)
      X_global[randIdx] = X_global[X_global.length - 1];
      Y_global[randIdx] = Y_global[Y_global.length - 1];
      X_global.pop();
      Y_global.pop();
    }
    X_global = sampledX;
    Y_global = sampledY;
  }

  // 2. Train One Universal Random Forest Model
  let regression: RFRegression | null = null;
  if (X_global.length >= 100) {
    const options = {
      seed: 42,
      maxFeatures: 4,
      replacement: true,
      nEstimators: 15 // Good balance of speed and accuracy
    };
    regression = new RFRegression(options);
    regression.train(X_global, Y_global);
  }

  // 3. Predict for each active cluster
  const historyByCluster: Record<string, typeof history> = {};
  for (const h of history) {
    const key = `${h.segment}|${h.province}`;
    if (!historyByCluster[key]) historyByCluster[key] = [];
    historyByCluster[key].push(h);
  }

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

    // Standard RF prediction
    if (!weatherCache[province]) {
      const provName = Object.values(PROVINCES_GEO).find(p => p.name === province);
      const lat = provName ? provName.lat : 40.4165;
      const lon = provName ? provName.lon : -3.7026;
      weatherCache[province] = await fetchForecastWeather(lat, lon, tomorrowStr);
    }

    const tomorrowTemps = weatherCache[province];
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
