const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function query() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`SELECT "profileData" FROM "Ppa" WHERE name ILIKE '%RENEE%'`);
  
  if (res.rows.length > 0) {
      const pd = res.rows[0].profileData;
      console.log(Array.isArray(pd) ? 'IS ARRAY' : 'IS OBJECT');
      
      if (Array.isArray(pd)) {
          pd.forEach((m, idx) => {
             if(m) {
                 const sum = m.reduce((a,b)=>a+b, 0);
                 console.log(`Index ${idx}: ${sum.toFixed(2)} MWh`);
             } else {
                 console.log(`Index ${idx}: null/undefined`);
             }
          });
      } else {
          for (const k of Object.keys(pd)) {
              const sum = pd[k].reduce((a,b)=>a+b, 0);
              console.log(`Key ${k}: ${sum.toFixed(2)} MWh`);
          }
      }
  } else {
      console.log('Not found');
  }
  
  await client.end();
}

query().catch(console.error);
