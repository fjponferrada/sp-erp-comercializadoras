const { Client } = require('pg');
const { fromZonedTime } = require('date-fns-tz');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  // June 1 to July 1
  const startDate = new Date('2026-05-31T22:00:00.000Z');
  const actualEndDate = new Date(new Date('2026-06-30T22:00:00.000Z').getTime() - 1000);
  const endDate = new Date('2026-06-30T22:00:00.000Z');

  const res = await client.query(`
    SELECT date, readings
    FROM "LoadCurve"
    WHERE cups LIKE 'ES0031405446869086QD%'
      AND date >= $1 AND date <= $2
    ORDER BY date ASC
  `, [new Date(startDate.getTime() - 24 * 3600 * 1000), new Date(actualEndDate.getTime() + 24 * 3600 * 1000)]);

  let totalCch = 0;
  for (const row of res.rows) {
    const lc = { date: new Date(row.date), readings: row.readings || [] };
    
    // THE FLAWED LOGIC IN THE ENGINE
    const dateIsoStr = lc.date.toISOString().substring(0, 10);
    
    let dayTotal = 0;
    const isQuarter = lc.readings.length === 96;
    if (isQuarter) {
      for (let q = 0; q < 96; q++) {
        const localStr = `${dateIsoStr}T${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}:00`;
        const qDate = fromZonedTime(localStr, 'Europe/Madrid');
        
        if (qDate < startDate || qDate >= endDate) continue;
        dayTotal += (lc.readings[q] || 0) / 1000.0;
      }
    } else {
      for (let h = 0; h < 24; h++) {
        const mwhHour = (lc.readings[h] || 0) / 1000.0;
        for (let q = 0; q < 4; q++) {
          const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
          const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
          
          if (hourDate < startDate || hourDate >= endDate) continue;
          dayTotal += mwhHour / 4.0;
        }
      }
    }

    if (dayTotal > 0) {
      totalCch += dayTotal;
    }
  }

  console.log(`Flawed Engine Total CCH for ERANOVUM: ${(totalCch * 1000).toFixed(2)} kWh`);
  await client.end();
}

main().catch(console.error);
