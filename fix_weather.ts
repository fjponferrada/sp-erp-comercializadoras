import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { PROVINCES_GEO } from './src/lib/services/ProvinceService';

async function fetchBulkWeather(lat: number, lon: number, startDate: string, endDate: string) {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&timezone=Europe/Madrid`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
    const data = await res.json();
    
    const result: Record<string, number[]> = {};
    const times: string[] = data.hourly.time;
    const temps: number[] = data.hourly.temperature_2m;
    
    for (let i = 0; i < times.length; i++) {
      const dateStr = times[i].split('T')[0];
      if (!result[dateStr]) result[dateStr] = [];
      result[dateStr].push(temps[i]);
    }
    return result;
  } catch (e) {
    console.error(`Error fetching bulk weather for lat ${lat}:`, e);
    return null;
  }
}

// Simple sleep function
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Fetching min/max dates from DB...');
  const minDateAgg = await prisma.aggregatedLoadCurve.aggregate({ _min: { date: true } });
  const maxDateAgg = await prisma.aggregatedLoadCurve.aggregate({ _max: { date: true } });
  
  if (!minDateAgg._min.date || !maxDateAgg._max.date) return;
  
  const startDate = minDateAgg._min.date.toISOString().split('T')[0];
  const endDate = maxDateAgg._max.date.toISOString().split('T')[0];
  
  console.log(`Date range: ${startDate} to ${endDate}`);
  
  // Fetch weather for all 52 provinces
  const globalWeatherCache: Record<string, Record<string, number[]>> = {};
  
  let i = 0;
  for (const provCode of Object.keys(PROVINCES_GEO)) {
    const geo = PROVINCES_GEO[provCode];
    console.log(`[${i+1}/52] Fetching bulk weather for ${geo.name}...`);
    
    const weather = await fetchBulkWeather(geo.lat, geo.lon, startDate, endDate);
    if (weather) {
      globalWeatherCache[geo.name] = weather;
    }
    
    // Delay to avoid Open-Meteo strict rate limits
    await sleep(2000);
    i++;
  }
  
  console.log('Finished fetching weather. Updating database...');
  
  const allRecords = await prisma.aggregatedLoadCurve.findMany({
    select: { id: true, date: true, province: true, temperature: true }
  });
  
  let updated = 0;
  
  for (const record of allRecords) {
    // Only update if it has the 20.0 fallback
    const isFallback = record.temperature.every(t => t === 20.0);
    if (!isFallback) continue;
    
    const dayStr = record.date.toISOString().split('T')[0];
    const provCache = globalWeatherCache[record.province];
    
    if (provCache && provCache[dayStr] && provCache[dayStr].length === 24) {
      await prisma.aggregatedLoadCurve.update({
        where: { id: record.id },
        data: { temperature: provCache[dayStr] }
      });
      updated++;
    }
  }
  
  console.log(`Successfully fixed ${updated} records!`);
}

main().catch(console.error).finally(() => process.exit(0));
