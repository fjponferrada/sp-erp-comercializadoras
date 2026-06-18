import { prisma } from '../prisma';
import { getProvinceGeo, PROVINCES_GEO } from './ProvinceService';
import { addDays, getDay, getMonth, format, subDays, startOfDay, isWeekend } from 'date-fns';
import { RandomForestRegression as RFRegression } from 'ml-random-forest';

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

  // Find max date in DB to get the latest 30 days available
  const maxAgg = await prisma.aggregatedLoadCurve.aggregate({ _max: { date: true } });
  let dbMaxDate = maxAgg._max.date || new Date();
  
  const history = await prisma.aggregatedLoadCurve.findMany({
    where: {
      date: {
        gte: subDays(dbMaxDate, 30) // Last 30 days of data for fast training
      }
    }
  });

  const historyByCluster: Record<string, typeof history> = {};
  for (const h of history) {
    const key = `${h.segment}|${h.province}`;
    if (!historyByCluster[key]) historyByCluster[key] = [];
    historyByCluster[key].push(h);
  }

  const finalPrediction: number[] = new Array(24).fill(0);
  const weatherCache: Record<string, number[]> = {};
  const vipPredictions: number[] = new Array(24).fill(0);

  // Train & Predict per cluster
  for (const [key, records] of Object.entries(historyByCluster)) {
    const [segment, province] = key.split('|');
    const activeCount = currentClients[key] || 0;
    
    if (activeCount === 0) continue; 
    
    if (segment === 'VIP') {
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

    const X: number[][] = [];
    const Y: number[] = [];

    for (const record of records) {
      if (record.clientCount === 0) continue;
      const d = record.date;
      const dow = getDay(d);
      const month = getMonth(d);
      const isWknd = isWeekend(d) ? 1 : 0;

      for (let h = 0; h < 24; h++) {
        const temp = record.temperature[h] ?? 20.0;
        const cons = record.totalConsumption[h] ?? 0;
        X.push([dow, month, h, temp, isWknd]);
        Y.push(cons / record.clientCount);
      }
    }

    if (X.length < 100) continue; 

    // VERY lightweight RF to respond quickly
    const options = {
      seed: 42,
      maxFeatures: 3,
      replacement: true,
      nEstimators: 20 
    };
    
    const regression = new RFRegression(options);
    regression.train(X, Y);

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

    const X_test: number[][] = [];
    for (let h = 0; h < 24; h++) {
      X_test.push([tDow, tMonth, h, tomorrowTemps[h], tIsWknd]);
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
