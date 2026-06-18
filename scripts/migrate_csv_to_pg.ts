import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import Papa from 'papaparse';
const csvPath = 'Z:\\AED\\Prediccion\\export_daily.csv';

async function main() {
  console.log('Iniciando lectura del CSV desde:', csvPath);
  
  if (!fs.existsSync(csvPath)) {
    console.error('El archivo CSV no existe.');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath, 'utf8');
  let count = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 10000;

  Papa.parse(fileStream, {
    header: true,
    skipEmptyLines: true,
    chunk: async (results, parser) => {
      parser.pause();
      
      for (const row of results.data as any) {
        const cups = row.cups;
        const date = new Date(`${row.fecha}T00:00:00.000Z`);
        
        const readings: number[] = [];
        for (let i = 0; i < 24; i++) {
          readings.push(parseFloat(row[`h${i}`] || '0'));
        }

        // Creamos un array de 96 posiciones para cumplir el tipado del Float[], 
        // pero rellenamos solo 24 posiciones activas para resolucion HOURLY,
        // o mapeamos a 24 elementos ( Prisma Float[] lo guarda tal cual, asique con 24 vale)
        
        batch.push({
          cups,
          date,
          readings,
          resolution: 'HOURLY',
          isProvisional: false,
          source: 'MIGRACION_PKL'
        });

        if (batch.length >= BATCH_SIZE) {
          try {
            await prisma.loadCurve.createMany({
              data: batch,
              skipDuplicates: true
            });
            count += batch.length;
            console.log(`Insertadas ${count} curvas de carga diarias...`);
          } catch (e) {
            console.error('Error insertando lote', e);
          }
          batch = [];
        }
      }
      
      parser.resume();
    },
    complete: async () => {
      if (batch.length > 0) {
        try {
          await prisma.loadCurve.createMany({
            data: batch,
            skipDuplicates: true
          });
          count += batch.length;
          console.log(`Insertadas ${count} curvas de carga diarias...`);
        } catch (e) {
          console.error('Error insertando lote final', e);
        }
      }
      console.log(`¡Migración completada! Total: ${count} filas`);
      await prisma.$disconnect();
    },
    error: (err) => {
      console.error('Error parseando CSV:', err);
    }
  });
}

main().catch(console.error);
