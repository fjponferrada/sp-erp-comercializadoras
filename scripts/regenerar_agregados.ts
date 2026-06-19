import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { subDays, startOfDay, addDays } from 'date-fns';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando regeneración de AggregatedLoadCurve...");

  console.log("Cargando mapeo de SupplyPoints...");
  const sps = await prisma.supplyPoint.findMany({
    select: { cups: true, segment: true, province: true },
    where: { segment: { not: null } }
  });

  const cupsInfo: Record<string, { segment: string, province: string }> = {};
  for (const sp of sps) {
    if (sp.segment) {
      const baseCups = sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups;
      cupsInfo[baseCups] = { segment: sp.segment, province: sp.province };
    }
  }

  console.log(`Tenemos mapeados ${Object.keys(cupsInfo).length} CUPS con segmento.`);

  const today = startOfDay(new Date());
  // Generar hasta 400 dias atras para asegurar cubrir al menos 1 año
  const startDate = subDays(today, 400);

  console.log(`Borrando AggregatedLoadCurve desde ${startDate.toISOString()}`);
  await prisma.aggregatedLoadCurve.deleteMany({
    where: { date: { gte: startDate } }
  });

  let currentDate = startDate;
  let totalInsertados = 0;
  
  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    const curves = await prisma.loadCurve.findMany({
      where: { date: currentDate }
    });

    if (curves.length === 0) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const agg: Record<string, { sum: number[], count: number }> = {};

    for (const curve of curves) {
      const info = cupsInfo[curve.cups];
      if (!info) continue;

      const key = `${info.segment}|${info.province}`;
      if (!agg[key]) {
        agg[key] = { sum: new Array(24).fill(0), count: 0 };
      }

      for (let i = 0; i < Math.min(24, curve.readings.length); i++) {
        agg[key].sum[i] += curve.readings[i] || 0;
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
      const [segment, province] = key.split('|');
      const temp = tempByProv[province] || new Array(24).fill(20.0);

      inserts.push({
        date: currentDate,
        segment,
        province,
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

    currentDate = addDays(currentDate, 1);
  }

  console.log(`¡Regeneración completada! Total agrupaciones insertadas: ${totalInsertados}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
