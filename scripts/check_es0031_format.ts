import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const targetMonthStart = new Date('2025-08-01T00:00:00Z');
  const targetMonthEnd = new Date('2025-08-31T23:59:59Z');

  // Let's pick a couple of ES0031 CUPS from the list
  const cupsList = [
    'ES0031105131691001XN',
    'ES0031101373874001ZQ',
    'ES0031102290918010GP',
    'ES0031104863192001CE'
  ];

  for (const cups of cupsList) {
    console.log(`\n=== Revisando CUPS: ${cups} ===`);
    
    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: { startsWith: cups },
        date: { gte: targetMonthStart, lte: targetMonthEnd }
      }
    });

    console.log(`Total de días de CCH encontrados en base de datos: ${loadCurves.length}`);
    
    if (loadCurves.length > 0) {
      // Dump the first curve to see the format
      const firstCurve = loadCurves[0];
      console.log(`Ejemplo de curva (Día ${firstCurve.date.toISOString().split('T')[0]}):`);
      console.log(`  - ¿Es provisional?: ${firstCurve.isProvisional}`);
      console.log(`  - Fuente: ${firstCurve.source}`);
      console.log(`  - Resolución: ${firstCurve.resolution}`);
      
      if (Array.isArray(firstCurve.readings)) {
        console.log(`  - Lecturas (Longitud: ${firstCurve.readings.length}):`);
        console.log(`  - Contenido:`, firstCurve.readings);
        const sum = firstCurve.readings.reduce((s, v) => s + (v || 0), 0);
        console.log(`  - Suma del día: ${sum} kWh`);
      } else {
        console.log(`  - [ERROR] Las lecturas no son un array. Tipo detectado: ${typeof firstCurve.readings}`);
        console.log(`  - Contenido crudo:`, firstCurve.readings);
      }

      // Sum all to see if they are just 0s
      let allZeros = true;
      for (const c of loadCurves) {
        if (Array.isArray(c.readings)) {
          const sum = c.readings.reduce((s, v) => s + (v || 0), 0);
          if (sum > 0) allZeros = false;
        }
      }
      
      if (allZeros) {
        console.log(`  -> ADVERTENCIA: Los ${loadCurves.length} días tienen un consumo total de 0 kWh (puro relleno de ceros).`);
      }
    } else {
      console.log(`  -> DIRECTAMENTE NO EXISTE EL REGISTRO EN BASE DE DATOS`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
