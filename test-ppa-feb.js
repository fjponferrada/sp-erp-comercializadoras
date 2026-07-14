const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function query() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  // Find PPA RJE
  const ppaRes = await client.query(`SELECT * FROM "PPA" WHERE name ILIKE '%RJE%' OR id ILIKE '%RJE%'`);
  let ppa;
  if (ppaRes.rows.length === 0) {
      // Just pick the first PPA if RJE is not the name
      const allPpas = await client.query(`SELECT * FROM "PPA" LIMIT 1`);
      ppa = allPpas.rows[0];
      console.log(`Using PPA: ${ppa.name}`);
  } else {
      ppa = ppaRes.rows[0];
      console.log(`Found PPA: ${ppa.name}`);
  }

  // Get PortfolioBaseCurve for Feb 2027
  const futureData = await client.query(`
    SELECT datetime, "omiePriceEurMwh" 
    FROM "PortfolioBaseCurve"
    WHERE EXTRACT(YEAR FROM datetime) = 2027 AND EXTRACT(MONTH FROM datetime) = 2
  `);

  let totalMwh = 0;
  let omieNumerator = 0;

  const profileData = ppa.profileData;
  const month = 1; // February is index 1

  for (const record of futureData.rows) {
      const date = new Date(record.datetime);
      const hour = date.getUTCHours();
      let mwThisHour = 0;
      
      if (ppa.subtype === 'CARGA_BASE') {
          mwThisHour = ppa.basePowerMw || 0;
      } else if (ppa.subtype === 'PERFIL_FIJO' && profileData) {
          if (profileData[month] && profileData[month][hour] !== undefined) {
              const daysInMonth = 28; // Feb 2027 has 28 days
              mwThisHour = Number(profileData[month][hour]) / daysInMonth;
          }
      }
      
      totalMwh += mwThisHour;
      omieNumerator += (record.omiePriceEurMwh * mwThisHour);
  }

  const omieMedio = totalMwh > 0 ? (omieNumerator / totalMwh) : 0;
  console.log(`Total MWh: ${totalMwh}`);
  console.log(`omieMedio (Capture Price): ${omieMedio}`);
  
  await client.end();
}

query().catch(console.error);
