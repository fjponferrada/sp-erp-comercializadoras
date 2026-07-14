const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT date, readings
    FROM "LoadCurve"
    WHERE cups LIKE 'ES0031405446869086QD%'
      AND date >= '2026-05-30'
      AND date <= '2026-07-02'
    ORDER BY date ASC
  `);

  console.log("Found rows:", res.rows.length);

  let totalMWh = 0;
  const startDate = new Date('2026-05-31T22:00:00.000Z');
  const endDate = new Date('2026-06-30T22:00:00.000Z');

  for (const lc of res.rows) {
    if (lc.readings && lc.readings.length === 24) {
      for (let q = 0; q < 24; q++) {
        const val = lc.readings[q] || 0;
        const mwhQuarter = val / 1000.0;
        
        const localDateObj = new Date(lc.date);
        const dateIsoStr = localDateObj.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
        
        const h = q;
        const localStr = dateIsoStr + 'T' + String(h).padStart(2, '0') + ':00:00+02:00';
        
        const hourDate = new Date(localStr);
        
        if (hourDate >= startDate && hourDate < endDate) {
          totalMWh += mwhQuarter;
        }
      }
    } else if (lc.readings && lc.readings.length === 96) {
      for (let q = 0; q < 96; q++) {
        const val = lc.readings[q] || 0;
        const mwhQuarter = val / 1000.0;
        
        const localDateObj = new Date(lc.date);
        const dateIsoStr = localDateObj.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
        
        const h = Math.floor(q / 4);
        const qM = q % 4;
        const localStr = dateIsoStr + 'T' + String(h).padStart(2, '0') + ':' + String(qM * 15).padStart(2, '0') + ':00+02:00';
        
        const hourDate = new Date(localStr);
        
        if (hourDate >= startDate && hourDate < endDate) {
          totalMWh += mwhQuarter;
        }
      }
    }
  }

  console.log("Calculated Total kWh:", totalMWh * 1000);
  await client.end();
}

main().catch(console.error);
