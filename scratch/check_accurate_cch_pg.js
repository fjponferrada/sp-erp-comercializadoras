const { Client } = require('pg');
const { fromZonedTime } = require('date-fns-tz');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const startDate = new Date('2026-05-31T22:00:00.000Z'); // June 1 00:00
  const endDate = new Date('2026-06-30T22:00:00.000Z');   // July 1 00:00
  
  const res = await client.query(`
    SELECT date, readings
    FROM "LoadCurve"
    WHERE cups LIKE 'ES0031405446869086QD%'
      AND date >= '2026-05-30' AND date <= '2026-07-02'
    ORDER BY date ASC
  `);

  let totalCch = 0;
  for (const row of res.rows) {
    const lc = { date: new Date(row.date), readings: row.readings || [] };
    
    // THE FIX: Use local time string, not UTC string!
    // Since lc.date is midnight local time (e.g. 2026-05-31T22:00:00.000Z = June 1 00:00)
    // toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }) gives "2026-06-01"
    const dateIsoStr = lc.date.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
    
    let dayTotal = 0;
    for (let h = 0; h < 24; h++) {
      const mwhHour = (lc.readings[h] || 0) / 1000.0;
      for (let q = 0; q < 4; q++) {
        const localStr = `${dateIsoStr}T${String(h).padStart(2, '0')}:${String(q * 15).padStart(2, '0')}:00`;
        const hourDate = fromZonedTime(localStr, 'Europe/Madrid');
        
        if (hourDate < startDate || hourDate >= endDate) continue;
        dayTotal += mwhHour / 4.0;
      }
    }

    if (dayTotal > 0) {
      console.log(`LC Date: ${dateIsoStr} -> Total: ${(dayTotal * 1000).toFixed(2)} kWh`);
      totalCch += dayTotal;
    }
  }

  console.log(`Total CCH: ${(totalCch * 1000).toFixed(2)} kWh`);
  await client.end();
}

main().catch(console.error);
