import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { subDays, startOfDay, addDays } from 'date-fns';
import { calculateSegment } from '../src/lib/services/SegmentService';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando regeneración de AggregatedLoadCurve...");

  console.log("Cargando mapeo de SupplyPoints y ventanas de contratos...");
  const sps = await prisma.supplyPoint.findMany({
    select: { 
      cups: true, 
      segment: true, 
      province: true,
      client: {
        select: { brand: { select: { companyId: true } } }
      },
      contracts: {
        select: {
          activationDate: true,
          terminationDate: true
        }
      },
      tariff: true,
      annualConsumption: true,
      p1c: true,
      cnae: true
    }
  });

  interface Window { start: number; end: number; }
  const cupsInfo: Record<string, { segment: string, province: string, tariff: string, companyId: string | null, windows: Window[] }> = {};

  for (const sp of sps) {
    const calculatedSegment = sp.segment || calculateSegment(sp.tariff, sp.annualConsumption, sp.p1c, sp.cnae);
    const baseCups = sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups;
      
    const windows: Window[] = [];
      for (const contract of sp.contracts) {
        if (contract.activationDate) {
          const start = contract.activationDate.getTime();
          const end = contract.terminationDate ? contract.terminationDate.getTime() : Infinity;
          windows.push({ start, end });
        }
      }

      // Merge windows or just keep them all. Since we only check if date falls in ANY window, no need to merge perfectly.
      // But if there are duplicates of CUPS in SupplyPoint, we append windows to existing ones.
      if (!cupsInfo[baseCups]) {
        cupsInfo[baseCups] = { 
          segment: calculatedSegment, 
          province: sp.province || 'Madrid', 
          tariff: sp.tariff || '2.0TD',
          companyId: sp.client?.brand?.companyId || null,
          windows: [] 
        };
      }
      cupsInfo[baseCups].windows.push(...windows);
  }

  console.log(`Tenemos mapeados ${Object.keys(cupsInfo).length} CUPS con segmento.`);

  const today = new Date();
  const startDate = new Date('2021-01-09T00:00:00.000Z');
  let currentDate = startDate;
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  console.log(`Borrando AggregatedLoadCurve desde ${startDate.toISOString()}`);
  await prisma.aggregatedLoadCurve.deleteMany({
    where: { date: { gte: startDate } }
  });

  let totalInsertados = 0;
  
  while (currentDate <= todayUtc) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const currentTime = currentDate.getTime();
    
    // Buscar todas las curvas de ese día (almacenadas a medianoche UTC)
    const curves = await prisma.loadCurve.findMany({
      where: { date: currentDate }
    });

    if (curves.length === 0) {
      currentDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() + 1));
      continue;
    }

    const agg: Record<string, { sum: number[], count: number }> = {};

    for (const curve of curves) {
      const info = cupsInfo[curve.cups.substring(0, 20)];
      if (!info) continue;

      // Filter by active window
      let isActive = false;
      if (info.windows.length === 0) {
        // If a SupplyPoint has NO contracts with activation dates, we assume it's NOT active.
        isActive = false;
      } else {
        for (const w of info.windows) {
          if (currentTime >= w.start && currentTime <= w.end) {
            isActive = true;
            break;
          }
        }
      }

      if (!isActive) {
        continue;
      }

      const key = `${info.companyId || 'NULL'}|${info.segment}|${info.province}|${info.tariff}`;
      if (!agg[key]) {
        agg[key] = { sum: new Array(24).fill(0), count: 0 };
      }

      if (curve.resolution === 'QUARTER_HOURLY') {
        for (let i = 0; i < curve.readings.length; i++) {
          const h = Math.floor(i / 4);
          if (h < 24) {
            agg[key].sum[h] += curve.readings[i] || 0;
          }
        }
      } else {
        for (let i = 0; i < Math.min(24, curve.readings.length); i++) {
          agg[key].sum[i] += curve.readings[i] || 0;
        }
      }
      agg[key].count++;
    }

    const weather = await prisma.weatherHistory.findMany({
      where: { date: currentDate }
    });
    const tempByProv: Record<string, number[]> = {};
    for (const w of weather) {
      tempByProv[w.province] = w.temperatures;
    }

    const inserts: any[] = [];
    for (const [key, data] of Object.entries(agg)) {
      const [companyIdStr, segment, province, tariff] = key.split('|');
      const companyId = companyIdStr === 'NULL' ? null : companyIdStr;
      const temp = tempByProv[province] || new Array(24).fill(20.0);

      inserts.push({
        date: currentDate,
        segment,
        province,
        tariff,
        companyId,
        totalConsumption: data.sum,
        clientCount: data.count,
        temperature: temp
      });
    }

    if (inserts.length > 0) {
      await prisma.aggregatedLoadCurve.createMany({
        data: inserts,
        skipDuplicates: true
      });
      totalInsertados += inserts.length;
    }
    
    if (currentDate.getDate() === 1) {
       console.log(`Procesado mes: ${dateStr}. Agregados generados: ${totalInsertados}`);
    }

    currentDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate() + 1));
  }
  
  console.log(`¡Regeneración completada! Total agrupaciones insertadas: ${totalInsertados}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
