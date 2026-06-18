import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { getProvinceGeo } from './src/lib/services/ProvinceService';
import { addDays, format, subDays } from 'date-fns';

async function fetchHistoricalWeather(lat: number, lon: number, startDate: string, endDate: string): Promise<Record<string, number[]>> {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&timezone=Europe/Madrid`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
    const data = await res.json();
    
    // Map data by day
    const result: Record<string, number[]> = {};
    const times: string[] = data.hourly.time;
    const temps: number[] = data.hourly.temperature_2m;
    
    for (let i = 0; i < times.length; i++) {
      // time is like "2025-04-12T00:00"
      const dateStr = times[i].split('T')[0];
      if (!result[dateStr]) result[dateStr] = [];
      result[dateStr].push(temps[i]);
    }
    
    return result;
  } catch (e) {
    console.error('Error fetching weather:', e);
    return {};
  }
}

async function main() {
  console.log('Starting historical aggregation...');
  
  // 1. We need all supply points mapping: id -> { segment, province }
  const sps = await prisma.supplyPoint.findMany({
    select: { id: true, segment: true, postalCode: true, cups: true }
  });
  
  const spMap: Record<string, { segment: string, province: string }> = {};
  for (const sp of sps) {
    if (!sp.segment) continue; // Skip unsegmented
    const geo = getProvinceGeo(sp.postalCode);
    spMap[sp.cups] = { segment: sp.segment, province: geo.name };
  }
  
  console.log(`Mapped ${Object.keys(spMap).length} supply points.`);

  // To avoid running out of memory, let's group LoadCurves by day directly from the DB using raw query or pulling by chunks.
  // Actually, doing it day by day is safest.
  
  // Get min and max dates
  const minDateAgg = await prisma.loadCurve.aggregate({ _min: { date: true } });
  const maxDateAgg = await prisma.loadCurve.aggregate({ _max: { date: true } });
  
  if (!minDateAgg._min.date || !maxDateAgg._max.date) {
    console.log('No load curves found.');
    return;
  }
  
  let current = new Date(minDateAgg._min.date);
  const end = new Date(maxDateAgg._max.date);
  
  while (current <= end) {
    const dayStr = current.toISOString().split('T')[0];
    console.log(`Processing ${dayStr}...`);
    
    const curves = await prisma.loadCurve.findMany({
      where: { date: current }
    });
    
    // Aggregation maps
    // Key: "Segment|Province"
    const aggMap: Record<string, { totalConsumption: number[], clientCount: number, province: string, segment: string }> = {};
    
    for (const c of curves) {
      const meta = spMap[c.cups];
      if (!meta) continue;
      
      const key = `${meta.segment}|${meta.province}`;
      if (!aggMap[key]) {
        aggMap[key] = { 
          totalConsumption: new Array(c.readings.length).fill(0), 
          clientCount: 0,
          province: meta.province,
          segment: meta.segment
        };
      }
      
      aggMap[key].clientCount++;
      for (let i = 0; i < c.readings.length; i++) {
        aggMap[key].totalConsumption[i] += c.readings[i];
      }
    }
    
    // For weather, we fetch batch per province
    // Let's gather all unique provinces used today
    const uniqueProvinces = Array.from(new Set(Object.values(aggMap).map(a => a.province)));
    const weatherCache: Record<string, number[]> = {};
    
    for (const provName of uniqueProvinces) {
      // Find lat/lon
      // We can reverse lookup or just fetch...
      // Let's use the first postalCode we find that matches the province
      let lat = 40.4165;
      let lon = -3.7026;
      for (const sp of sps) {
        if (getProvinceGeo(sp.postalCode).name === provName) {
          const geo = getProvinceGeo(sp.postalCode);
          lat = geo.lat;
          lon = geo.lon;
          break;
        }
      }
      
      const w = await fetchHistoricalWeather(lat, lon, dayStr, dayStr);
      weatherCache[provName] = w[dayStr] || new Array(24).fill(20.0); // fallback to 20C
    }
    
    // Save to DB
    for (const val of Object.values(aggMap)) {
      await prisma.aggregatedLoadCurve.upsert({
        where: {
          date_segment_province: {
            date: current,
            segment: val.segment,
            province: val.province
          }
        },
        create: {
          date: current,
          segment: val.segment,
          province: val.province,
          totalConsumption: val.totalConsumption,
          clientCount: val.clientCount,
          temperature: weatherCache[val.province]
        },
        update: {
          totalConsumption: val.totalConsumption,
          clientCount: val.clientCount,
          temperature: weatherCache[val.province]
        }
      });
    }
    
    current = addDays(current, 1);
  }
  
  console.log('Aggregation complete!');
}

main().catch(console.error).finally(() => process.exit(0));
