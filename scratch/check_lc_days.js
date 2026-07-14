const { PrismaClient } = require('@prisma/client');
const { fromZonedTime } = require('date-fns-tz');

async function main() {
  const prisma = new PrismaClient();
  const startDate = new Date('2026-05-30T22:00:00.000Z');
  const endDate = new Date('2026-06-29T22:00:00.000Z');
  
  const loadCurves = await prisma.loadCurve.findMany({
    where: {
      cups: { startsWith: 'ES0031405446869086QD' },
      date: {
        gte: new Date(startDate.getTime() - 24 * 3600 * 1000),
        lte: new Date(endDate.getTime() + 24 * 3600 * 1000)
      }
    },
    orderBy: { date: 'asc' }
  });

  let totalCch = 0;
  let countDays = 0;
  for (const lc of loadCurves) {
    let dayTotal = 0;
    const isQuarter = lc.readings.length === 96;
    if (isQuarter) {
      for (let q = 0; q < 96; q++) {
        const dateIsoStr = lc.date.toISOString().substring(0, 10);
        const localStr = `${dateIsoStr}T${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}:00`;
        const qDate = fromZonedTime(localStr, 'Europe/Madrid');
        
        if (qDate < startDate || qDate >= endDate) continue;
        
        const mwh = (lc.readings[q] || 0) / 1000.0;
        dayTotal += mwh;
      }
    } else {
      for (let h = 0; h < 24; h++) {
        const mwhHour = (lc.readings[h] || 0) / 1000.0;
        for (let q = 0; q < 4; q++) {
          const dateIsoStr = lc.date.toISOString().substring(0, 10);
          const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
          const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
          
          if (hourDate < startDate || hourDate >= endDate) continue;
          dayTotal += mwhHour / 4.0;
        }
      }
    }

    if (dayTotal > 0) {
      console.log(`LC Date: ${lc.date.toISOString().substring(0, 10)} -> Total: ${(dayTotal * 1000).toFixed(2)} kWh`);
      totalCch += dayTotal;
      countDays++;
    } else {
      console.log(`LC Date: ${lc.date.toISOString().substring(0, 10)} -> OUT OF RANGE or 0`);
    }
  }

  console.log(`Total CCH: ${(totalCch * 1000).toFixed(2)} kWh over ${countDays} days.`);
}

main().catch(console.error);
