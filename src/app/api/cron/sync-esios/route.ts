import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EsiosService } from '@/lib/services/EsiosService';
import { subDays, format } from 'date-fns';

// Configuración de indicadores a sincronizar
// 1739: Coeficientes de pérdidas 2.0TD
// 1740: Coeficientes de pérdidas 3.0TD
// 600: Precio mercado diario OMIE
// 806: Restricciones PBF (RT3)
// 807: Restricciones TR (RT6)
// 811: Banda Secundaria (BS3)
// 813: Saldo Desvíos (EXD)
// 814: Pagos Capacidad (IN7)
// 1286: Control Factor Potencia (CFP)
// 1368: Energía de balance (BALX)
const ESIOS_INDICATORS = [1739, 1740, 600, 806, 807, 811, 813, 814, 1286, 1368];
const DAYS_TO_SYNC = 365;

export async function GET(req: Request) {
  try {
    console.log('Iniciando sincronización con ESIOS...');

    if (!process.env.ESIOS_API_TOKEN) {
      return NextResponse.json({ error: 'ESIOS_API_TOKEN no configurado' }, { status: 401 });
    }

    const endDate = new Date();
    const startDate = subDays(endDate, DAYS_TO_SYNC);
    
    // ESIOS espera formato ISO estricto para fechas
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    let totalSaved = 0;

    for (const indicatorId of ESIOS_INDICATORS) {
      try {
        console.log(`Descargando indicador ${indicatorId}...`);
        const rawIndicator = await EsiosService.fetchIndicator(indicatorId, startStr, endStr);
        
        const records = EsiosService.processIndicatorData(rawIndicator);
        
        if (records.length === 0) {
          console.log(`No hay datos para el indicador ${indicatorId} en este periodo.`);
          continue;
        }

        // Upsert en base de datos optimizado en bloques para evitar timeouts en Vercel
        const chunkSize = 50;
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          await Promise.all(chunk.map(record => 
            prisma.esiosIndicatorData.upsert({
              where: {
                indicatorId_date: {
                  indicatorId: record.indicatorId,
                  date: record.date
                }
              },
              update: {
                values: record.values,
                name: record.name
              },
              create: {
                indicatorId: record.indicatorId,
                name: record.name,
                date: record.date,
                values: record.values
              }
            })
          ));
        }

        totalSaved += records.length;
        console.log(`Indicador ${indicatorId} guardado. (${records.length} días)`);
        
        // Pequeña pausa para no saturar la API
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        console.error(`Error procesando indicador ${indicatorId}:`, err.message);
        // Continuamos con el siguiente indicador
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sincronización finalizada. Guardados/actualizados ${totalSaved} registros.` 
    });

  } catch (error: any) {
    console.error('Error global en cron de ESIOS:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
