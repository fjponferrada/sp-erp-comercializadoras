const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const f1Res = await client.query(`SELECT "fechaInicio", "fechaFin", "supplyPointId" FROM "F1Invoice" WHERE id = 'cmrahn7u2006u04k2rmcrmcgm'`);
  const f1 = f1Res.rows[0];
  console.log('F1 fechaInicio:', f1.fechaInicio.toISOString());
  console.log('F1 fechaFin:', f1.fechaFin.toISOString());

  const lcRes = await client.query(`
    SELECT date 
    FROM "LoadCurve" 
    WHERE cups = 'ES0031405446869086QD' 
    AND date >= '${new Date(f1.fechaInicio.getTime() - 24*3600*1000).toISOString()}' 
    AND date <= '${new Date(f1.fechaFin.getTime() + 24*3600*1000).toISOString()}'
    ORDER BY date ASC LIMIT 5
  `);
  
  for (const lc of lcRes.rows) {
    let skipped = (lc.date < f1.fechaInicio || lc.date >= f1.fechaFin);
    console.log(`LC Date: ${lc.date.toISOString()} -> Skipped: ${skipped}`);
    
    if (!skipped) {
        for(let h=0; h<24; h++) {
            const d = new Date(lc.date.getTime() + h*3600*1000);
            console.log('   Hour:', d.toISOString(), '-> Madrid:', d.toLocaleString('sv-SE', {timeZone: 'Europe/Madrid'}));
            if(h>2) break;
        }
    }
  }

  await client.end();
}
main().catch(console.error);
