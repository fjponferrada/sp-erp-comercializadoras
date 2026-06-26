import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

export async function GET() {
  try {
    const results: any = {};
    
    // 1. IMPORT BD_REE.csv
    const bdReePath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\BD_REE.csv';
    if (fs.existsSync(bdReePath)) {
      const content = fs.readFileSync(bdReePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });
      
      const dailyData: Record<string, Record<string, number[]>> = {};
      for (const r of records as any[]) {
        const dt = new Date(r.datetime);
        if (isNaN(dt.getTime())) continue;
        const dayKey = dt.toISOString().split('T')[0];
        const hour = dt.getHours(); 
        
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

      await prisma.systemComponentPrice.deleteMany({
        where: { component: { in: ['RESTRICCIONES', 'OS', 'PERD_20TD', 'PERD_30TD', 'PERD_61TD', 'PERD_30TDVE'] } }
      });

      let count = 0;
      for (const [dayKey, comps] of Object.entries(dailyData)) {
        const date = new Date(dayKey + 'T00:00:00Z');
        for (const [compName, valuesArray] of Object.entries(comps)) {
          await prisma.systemComponentPrice.create({
            data: { component: compName, date: date, values: valuesArray }
          });
          count++;
        }
      }
      results.bdRee = `Inserted ${count} records`;
    }

    // 2. IMPORT COSTES_REGULADOS.csv
    const regPath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\COSTES_REGULADOS.csv';
    if (fs.existsSync(regPath)) {
      const content = fs.readFileSync(regPath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });

      await prisma.regulatedCost.deleteMany({});
      let count = 0;
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
        count++;
      }
      results.regulated = `Inserted ${count} records`;
    }

    // 3. IMPORT FUTUROS.csv
    const futPath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\FUTUROS.csv';
    if (fs.existsSync(futPath)) {
      const content = fs.readFileSync(futPath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });

      const monthMap: Record<string, number> = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
      };

      await prisma.futurePrice.deleteMany({});
      let count = 0;
      for (const r of records as any[]) {
        if (!r.Mes) continue;
        const mStr = r.Mes.trim().toLowerCase();
        const mIdx = monthMap[mStr];
        if (mIdx) {
          await prisma.futurePrice.create({
            data: {
              month: mIdx,
              price: parseFloat(r.Precio_Objetivo.replace(',', '.'))
            }
          });
          count++;
        }
      }
      results.futuros = `Inserted ${count} future records`;
    }

    // 4. IMPORT CURVA_COSTE_PORTFOLIO.csv
    const curvaPath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\CURVA_COSTE_PORTFOLIO.csv';
    if (fs.existsSync(curvaPath)) {
      const content = fs.readFileSync(curvaPath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });

      await prisma.portfolioBaseCurve.deleteMany({});
      
      const portfolioRecords: any[] = [];
      for (const r of records as any[]) {
        if (!r.datetime) continue;
        const dt = new Date(r.datetime.replace(' ', 'T') + 'Z');
        if (isNaN(dt.getTime())) continue;

        portfolioRecords.push({
          datetime: dt,
          basePriceEurMwh: parseFloat(r.Precio_Base_Portfolio?.replace(',', '.') || '0'),
          omiePriceEurMwh: parseFloat(r.precio_omie?.replace(',', '.') || '0'),
          demandMwh: parseFloat(r.demanda_mwh?.replace(',', '.') || '0'),
          ppaMwh: parseFloat(r.ppa_mwh?.replace(',', '.') || '0')
        });
      }
      
      const batchSize = 5000;
      for (let i = 0; i < portfolioRecords.length; i += batchSize) {
        await prisma.portfolioBaseCurve.createMany({
          data: portfolioRecords.slice(i, i + batchSize),
          skipDuplicates: true
        });
      }
      results.curvaPortfolio = `Inserted ${portfolioRecords.length} portfolio records`;
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}
