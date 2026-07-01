import { prisma } from '../prisma';
import { subDays, startOfDay, addDays } from 'date-fns';

export class AggregationService {
  /**
   * Regenera la tabla AggregatedLoadCurve para los últimos X días.
   * Por defecto, procesa los últimos 60 días para evitar timeouts en serverless.
   * @param days Número de días hacia atrás a regenerar
   */
  static async regenerateAggregates(days: number = 60) {
    console.log(`Iniciando regeneración de AggregatedLoadCurve para los últimos ${days} días...`);

    // 1. Obtener mapeo de SupplyPoints y quitar el sufijo "0F" para emparejar con LoadCurve
    const sps = await prisma.supplyPoint.findMany({
      select: { cups: true, segment: true, province: true }
    });

    const cupsInfo: Record<string, { segment: string, province: string }> = {};
    for (const sp of sps) {
      const baseCups = sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups;
      cupsInfo[baseCups] = { 
        segment: sp.segment || '2.0TD',
        province: sp.province || 'Madrid'
      };
    }

    const today = startOfDay(new Date());
    const startDate = subDays(today, days);

    // 2. Borrar las agrupaciones del rango solicitado
    await prisma.aggregatedLoadCurve.deleteMany({
      where: { date: { gte: startDate } }
    });

    let currentDate = startDate;
    let totalInsertados = 0;
    
    // 3. Procesar día a día
    while (currentDate <= today) {
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

      currentDate = addDays(currentDate, 1);
    }

    console.log(`¡Regeneración completada! Total agrupaciones insertadas: ${totalInsertados}`);
    return totalInsertados;
  }
}
