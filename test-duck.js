const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function query() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  // Get historical OMIE data for February (month 2)
  const res = await client.query(`
    SELECT "values", date 
    FROM "SystemComponentPrice" 
    WHERE component = 'OMIE' AND EXTRACT(MONTH FROM date) = 2
  `);
  
  let hoursCount = 0;
  let sumPrices = 0;
  for(let i=0; i<24; i++) {
     let hrSum = 0;
     let c = 0;
     for(let row of res.rows) {
         if (row.values && row.values[i] !== undefined) {
             hrSum += row.values[i];
             c++;
         }
     }
     let avgHr = hrSum / c;
     console.log(`Hour ${i}: ${avgHr.toFixed(2)}`);
  }
  
  await client.end();
}

query().catch(console.error);
