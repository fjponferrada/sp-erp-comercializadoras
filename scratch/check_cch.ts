import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const cups = 'ES0031405446869086QD'; // use base cups
  const startDate = new Date('2026-05-31');
  const endDate = new Date('2026-06-30');

  const loadCurves = await prisma.loadCurve.findMany({
    where: {
      cups: { startsWith: cups },
      date: {
        gte: new Date(startDate.getTime() - 24 * 3600 * 1000),
        lte: new Date(endDate.getTime() + 24 * 3600 * 1000)
      }
    },
    orderBy: { date: 'asc' }
  });

  console.log(`Found ${loadCurves.length} CCH records for CUPS ${cups} in June 2026.`);
  
  if (loadCurves.length > 0) {
    let totalConsumo = 0;
    for(const lc of loadCurves) {
      if(lc.date >= startDate && lc.date < endDate) {
        let sum = lc.readings.reduce((a, b) => a + b, 0);
        totalConsumo += sum;
      }
    }
    console.log(`Total consumption in DB (within date range): ${totalConsumo/1000} kWh`);
    
    console.log("First 2 records readings:");
    loadCurves.slice(0, 2).forEach(c => {
      console.log(`Date: ${c.date.toISOString()}, Readings count: ${c.readings.length}`);
      console.log(`First 10:`, c.readings.slice(0,10));
      console.log(`Total for this day: ${c.readings.reduce((a, b) => a + b, 0)/1000} kWh`);
    });
  } else {
     console.log("NO LOAD CURVES FOUND FOR CUPS!");
  }
}

main()
  .catch(e => console.error(e))
  //.finally(() => prisma.$disconnect());
