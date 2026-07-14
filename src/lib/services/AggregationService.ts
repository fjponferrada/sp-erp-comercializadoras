import { prisma } from '../prisma';
import { subDays, startOfDay, addDays } from 'date-fns';
import { calculateSegment } from './SegmentService';

export class AggregationService {
  /**
   * Regenera la tabla AggregatedLoadCurve para los últimos X días.
   * Por defecto, procesa los últimos 60 días para evitar timeouts en serverless.
   * @param days Número de días hacia atrás a regenerar
   */
  static async regenerateAggregates(days: number = 60, targetCompanyId?: string) {
    console.log(`Iniciando regeneración de AggregatedLoadCurve para los últimos ${days} días (Compañía: ${targetCompanyId || 'TODAS'})...`);

    // 1. Obtener mapeo de SupplyPoints y quitar el sufijo "0F" para emparejar con LoadCurve
    const spWhere: any = {};
    if (targetCompanyId) {
      spWhere.client = { brand: { companyId: targetCompanyId } };
    }

    const sps = await prisma.supplyPoint.findMany({
      where: spWhere,
      select: { 
        cups: true, 
        segment: true, 
        province: true, 
        tariff: true,
        annualConsumption: true,
        p1c: true,
        cnae: true,
        client: {
          select: {
            brand: {
              select: {
                companyId: true
              }
            }
          }
        },
        contracts: {
          select: {
            status: true,
            activationDate: true,
            terminationDate: true
          }
        }
      }
    });

    type ContractInfo = { status: string; activationDate: Date | null; terminationDate: Date | null };
    const cupsInfo: Record<string, { segment: string, province: string, tariff: string, companyId: string | null, contracts: ContractInfo[] }> = {};
    for (const sp of sps) {
      const calculatedSegment = sp.segment || calculateSegment(sp.tariff, sp.annualConsumption, sp.p1c, sp.cnae);
      const baseCups = sp.cups.substring(0, 20);
      
      if (!cupsInfo[baseCups]) {
        cupsInfo[baseCups] = { 
          segment: calculatedSegment,
          province: sp.province || 'Madrid',
          tariff: sp.tariff || '2.0TD',
          companyId: sp.client?.brand?.companyId || null,
          contracts: []
        };
      }
      cupsInfo[baseCups].contracts.push(...sp.contracts);
    }

    const today = startOfDay(new Date());
    const startDate = subDays(today, days);

    // 2. Borrar las agrupaciones del rango solicitado
    const deleteWhere: any = { date: { gte: startDate } };
    if (targetCompanyId) {
      deleteWhere.companyId = targetCompanyId;
    }

    await prisma.aggregatedLoadCurve.deleteMany({
      where: deleteWhere
    });

    let currentDate = startDate;
    let totalInsertados = 0;
    
    // 3. Procesar día a día
    while (currentDate <= today) {
      const curves = await prisma.loadCurve.findMany({
        where: { date: currentDate, type: 'CONSUMPTION' }
      });

      if (curves.length === 0) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      const agg: Record<string, { sum: number[], count: number }> = {};

      for (const curve of curves) {
        const info = cupsInfo[curve.cups.substring(0, 20)];
        if (!info) continue;

        let isActive = false;
        if (info.contracts.length === 0) {
          isActive = false;
        } else {
          for (const c of info.contracts) {
            // Evaluamos la ventana de tiempo del contrato sin importar si está TERMINATED hoy.
            // Si estuvo activo en currentDate, nos vale.
            if (c.activationDate) {
              const start = startOfDay(c.activationDate);
              const end = c.terminationDate ? startOfDay(c.terminationDate) : null;
              if (currentDate >= start) {
                if (!end || currentDate <= end) {
                  isActive = true;
                  break;
                }
              }
            }
          }
        }

        if (!isActive) continue;

        const key = `${info.companyId || 'null'}|${info.segment}|${info.province}|${info.tariff}`;
        if (!agg[key]) {
          agg[key] = { sum: new Array(24).fill(0), count: 0 };
        }

        if (curve.resolution === 'QUARTER_HOURLY') {
          // Cada 4 lecturas cuartohorarias conforman 1 hora
          const numReadings = curve.readings.length;
          for (let i = 0; i < numReadings; i++) {
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
        const temp = tempByProv[province] || new Array(24).fill(20.0);
        const companyId = companyIdStr === 'null' ? null : companyIdStr;

        inserts.push({
          date: currentDate,
          segment,
          province,
          tariff,
          totalConsumption: data.sum,
          clientCount: data.count,
          temperature: temp,
          companyId
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
