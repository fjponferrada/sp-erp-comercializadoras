import { prisma } from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

const MESES_MAP: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

function parseDateDDMMYYYY(dateStr: string) {
  const [day, month, year] = dateStr.split('/');
  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
}

function parseFloatSafe(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  return parseFloat(val.replace(',', '.'));
}

async function importRegulatedCosts(filePath: string) {
  console.log(`Leyendo ${filePath}...`);
  if (!fs.existsSync(filePath)) return console.log('Archivo no encontrado.');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 11) continue;
    
    const [concept, tariff, fechaIn, fechaFin, p1, p2, p3, p4, p5, p6, singleVal] = cols;
    
    const validFrom = parseDateDDMMYYYY(fechaIn);
    const validTo = parseDateDDMMYYYY(fechaFin);

    await prisma.regulatedCost.create({
      data: {
        concept: concept.trim(),
        tariff: tariff.trim(),
        validFrom,
        validTo,
        p1: parseFloatSafe(p1),
        p2: parseFloatSafe(p2),
        p3: parseFloatSafe(p3),
        p4: parseFloatSafe(p4),
        p5: parseFloatSafe(p5),
        p6: parseFloatSafe(p6),
        singleValue: parseFloatSafe(singleVal)
      }
    });
  }
  console.log('Costes regulados importados.');
}

async function importFuturePrices(filePath: string) {
  console.log(`Leyendo ${filePath}...`);
  if (!fs.existsSync(filePath)) return console.log('Archivo no encontrado.');

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 2) continue;

    const monthStr = cols[0].trim().toLowerCase();
    const priceStr = cols[1];

    const monthNum = MESES_MAP[monthStr];
    if (monthNum) {
      await prisma.futurePrice.upsert({
        where: { year_month: { year: 2026, month: monthNum } },
        update: { price: parseFloatSafe(priceStr) || 65 },
        create: {
          year: 2026,
          month: monthNum,
          price: parseFloatSafe(priceStr) || 65
        }
      });
    }
  }
  console.log('Precios futuros importados.');
}

async function importTimeSeriesData(filePath: string, componentsMap: string[], startColIdx: number = 1) {
  console.log(`Leyendo ${filePath}...`);
  if (!fs.existsSync(filePath)) return console.log('Archivo no encontrado.');

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');
  
  // Agrupar por fecha
  const dataByDate: Record<string, Record<string, number[]>> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < componentsMap.length + startColIdx) continue;
    
    const datetimeStr = cols[0];
    const dt = new Date(datetimeStr);
    if (isNaN(dt.getTime())) continue;

    const dateKey = dt.toISOString().split('T')[0];
    
    if (!dataByDate[dateKey]) {
      dataByDate[dateKey] = {};
      for (const comp of componentsMap) {
        dataByDate[dateKey][comp] = new Array(24).fill(0);
      }
    }

    const hour = dt.getUTCHours();
    
    for (let j = 0; j < componentsMap.length; j++) {
      const comp = componentsMap[j];
      const val = parseFloatSafe(cols[startColIdx + j]) || 0;
      dataByDate[dateKey][comp][hour] = val;
    }
  }

  // Insertar en SystemComponentPrice
  const dates = Object.keys(dataByDate);
  console.log(`Encontrados ${dates.length} días para ${componentsMap.join(', ')}`);
  
  // Como son muchos, procesamos en pequeños bloques
  for (const dateStr of dates) {
    const dbDate = new Date(dateStr);
    const comps = dataByDate[dateStr];
    
    for (const comp of componentsMap) {
      const values = comps[comp];
      await prisma.systemComponentPrice.upsert({
        where: {
          component_date: {
            component: comp.toUpperCase(),
            date: dbDate
          }
        },
        update: { values },
        create: {
          component: comp.toUpperCase(),
          date: dbDate,
          values
        }
      });
    }
  }
  console.log(`Importación de ${filePath} finalizada.`);
}

async function main() {
  console.log('Borrando datos antiguos de RegulatedCost para evitar duplicados...');
  await prisma.regulatedCost.deleteMany({});

  await importRegulatedCosts('Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/COSTES_REGULADOS.csv');
  await importFuturePrices('Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/2-PRICING/FUTUROS.csv');
  
  console.log('Importando OMIE...');
  await importTimeSeriesData('Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/2-PRICING/BD_OMIE.csv', ['OMIE']);
  
  console.log('Importando REE...');
  await importTimeSeriesData('Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/BD_REE.csv', [
    'RESTRICCIONES', 'OS', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD', 'PERD_30TDVE'
  ]);

  console.log('¡Importación completada!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
