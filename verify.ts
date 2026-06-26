import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { prisma } from './src/lib/prisma';
import fs from 'fs';

async function main() {
  const csvPath = 'Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/COMPODEM/202603/CARGA_BD_REE_AUTOMATICA.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  
  const header = csvContent[0].split(';');
  const dataRows = csvContent.slice(1);

  console.log(`CSV has ${dataRows.length} rows.`);

  // Load from DB
  const startDate = new Date('2026-03-01T00:00:00.000Z');
  const endDate = new Date('2026-03-31T00:00:00.000Z');

  const dbData = await prisma.systemComponentPrice.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  console.log(`DB has ${dbData.length} rows for March 2026.`);

  // Group DB by date and component
  const dbMap = new Map();
  for (const row of dbData) {
    const dStr = row.date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!dbMap.has(dStr)) dbMap.set(dStr, {});
    dbMap.get(dStr)[row.component] = row.values;
  }

  // Compare March 1st hour 0
  const row0 = dataRows[0].split(';');
  const dateStr = row0[0]; // 2026-03-01T00:00:00+01:00
  const yyyymmdd = dateStr.substring(0, 10);
  const hourMatch = dateStr.match(/T(\d{2}):/);
  const hour = hourMatch ? parseInt(hourMatch[1], 10) : 0;

  console.log(`Checking ${yyyymmdd} hour ${hour}`);

  const dbDay = dbMap.get(yyyymmdd);
  if (!dbDay) {
    console.log(`No DB data for ${yyyymmdd}`);
    return;
  }

  const csvRestricciones = parseFloat(row0[1].replace(',', '.'));
  const csvOS = parseFloat(row0[2].replace(',', '.'));
  const csvTotal = parseFloat(row0[3].replace(',', '.'));
  const csvBALX = parseFloat(row0[4].replace(',', '.'));

  console.log('--- DB VS CSV ---');
  console.log(`RESTRICCIONES: DB=${dbDay['RESTRICCIONES'][hour]} | CSV=${csvRestricciones}`);
  console.log(`OS: DB=${dbDay['OS'][hour]} | CSV=${csvOS}`);
  console.log(`TOTAL: DB=${dbDay['TOTAL_COMPODEM'][hour]} | CSV=${csvTotal}`);
  console.log(`BALX: DB=${dbDay['BALX'][hour]} | CSV=${csvBALX}`);

  // Check differences
  let diffRest = Math.abs(dbDay['RESTRICCIONES'][hour] - csvRestricciones);
  let diffOS = Math.abs(dbDay['OS'][hour] - csvOS);
  let diffTotal = Math.abs(dbDay['TOTAL_COMPODEM'][hour] - csvTotal);

  console.log(`\nDifferences:`);
  console.log(`RESTRICCIONES Diff: ${diffRest < 0.0001 ? '✅ OK' : `❌ ${diffRest}`}`);
  console.log(`OS Diff: ${diffOS < 0.0001 ? '✅ OK' : `❌ ${diffOS}`}`);
  console.log(`TOTAL Diff: ${diffTotal < 0.0001 ? '✅ OK' : `❌ ${diffTotal}`}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
