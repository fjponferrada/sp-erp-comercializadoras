import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting import...");

  // 1. IMPORT BD_REE.csv
  const bdReePath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\BD_REE.csv';
  if (fs.existsSync(bdReePath)) {
    console.log("Importing BD_REE.csv...");
    const content = fs.readFileSync(bdReePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });
    
    // Group by Date and Component
    const dailyData: Record<string, Record<string, number[]>> = {};
    // components: RESTRICCIONES, OS, PERD_20TD, PERD_30TD, PERD_61TD, PERD_30TDVE

    for (const r of records as any[]) {
      const dt = new Date(r.datetime);
      if (isNaN(dt.getTime())) continue;
      
      const dayKey = dt.toISOString().split('T')[0];
      const hour = dt.getHours(); // 0-23
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = {
          RESTRICCIONES: new Array(24).fill(0),
          OS: new Array(24).fill(0),
          PERD_20TD: new Array(24).fill(0),
          PERD_30TD: new Array(24).fill(0),
          PERD_61TD: new Array(24).fill(0),
          PERD_30TDVE: new Array(24).fill(0)
        };
      }

      dailyData[dayKey].RESTRICCIONES[hour] = parseFloat(r.restricciones?.replace(',', '.') || '0');
      dailyData[dayKey].OS[hour] = parseFloat(r.os?.replace(',', '.') || '0');
      dailyData[dayKey].PERD_20TD[hour] = parseFloat(r.coef_perd_20td?.replace(',', '.') || '0');
      dailyData[dayKey].PERD_30TD[hour] = parseFloat(r.coef_perd_30td?.replace(',', '.') || '0');
      dailyData[dayKey].PERD_61TD[hour] = parseFloat(r.coef_perd_61td?.replace(',', '.') || '0');
      dailyData[dayKey].PERD_30TDVE[hour] = parseFloat(r.coef_perd_30tdve?.replace(',', '.') || '0');
    }

    console.log(`Processing ${Object.keys(dailyData).length} days from BD_REE...`);
    let count = 0;
    
    // Clear old data for these components
    await prisma.systemComponentPrice.deleteMany({
      where: { component: { in: ['RESTRICCIONES', 'OS', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD', 'PERD_30TDVE'] } }
    });

    for (const [dayKey, comps] of Object.entries(dailyData)) {
      const date = new Date(dayKey + 'T00:00:00Z');
      for (const [compName, valuesArray] of Object.entries(comps)) {
        await prisma.systemComponentPrice.create({
          data: {
            component: compName,
            date: date,
            values: valuesArray
          }
        });
        count++;
      }
    }
    console.log(`Inserted ${count} component day records.`);
  } else {
    console.warn(`File not found: ${bdReePath}`);
  }

  // 2. IMPORT COSTES_REGULADOS.csv
  const regPath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\COSTES_REGULADOS.csv';
  if (fs.existsSync(regPath)) {
    console.log("Importing COSTES_REGULADOS.csv...");
    const content = fs.readFileSync(regPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });

    await prisma.regulatedCost.deleteMany({});

    for (const r of records as any[]) {
      if (!r.Concepto) continue;
      
      const parseDate = (dStr: string) => {
        if (!dStr) return new Date();
        const [day, month, year] = dStr.split('/');
        return new Date(`${year}-${month}-${day}T00:00:00Z`);
      };

      const parseFloatSafe = (val: string) => val ? parseFloat(val.replace(',', '.')) : null;

      await prisma.regulatedCost.create({
        data: {
          concept: r.Concepto,
          tariff: r.Tarifa || 'TODAS',
          validFrom: parseDate(r.Fecha_Inicio),
          validTo: parseDate(r.Fecha_Fin),
          p1: parseFloatSafe(r.P1),
          p2: parseFloatSafe(r.P2),
          p3: parseFloatSafe(r.P3),
          p4: parseFloatSafe(r.P4),
          p5: parseFloatSafe(r.P5),
          p6: parseFloatSafe(r.P6),
          singleValue: parseFloatSafe(r.Valor_Unico)
        }
      });
    }
    console.log("Imported COSTES_REGULADOS.");
  } else {
    console.warn(`File not found: ${regPath}`);
  }

  console.log("Import finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
