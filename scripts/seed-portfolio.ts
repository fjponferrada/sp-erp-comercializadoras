import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

async function main() {
  const curvaPath = 'Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\CURVA_COSTE_PORTFOLIO.csv';
  if (fs.existsSync(curvaPath)) {
    const content = fs.readFileSync(curvaPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, delimiter: ';' });

    await prisma.portfolioBaseCurve.deleteMany({});
    
    const portfolioRecords = [];
    for (const r of records) {
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
    console.log(`Inserted ${portfolioRecords.length} portfolio records`);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
