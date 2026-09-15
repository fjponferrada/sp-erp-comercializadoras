const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function query() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`SELECT id, "profileData" FROM "Ppa" WHERE name ILIKE '%RENEE%'`);
  
  if (res.rows.length > 0) {
      const ppa = res.rows[0];
      const pd = ppa.profileData;
      
      if (Array.isArray(pd) && pd.length === 12) {
          // Revert the shift. We previously did: new[0] = old[11]
          // Now we need to undo that. 
          // old[0] (which is currently Jan) should be moved back to the end (Index 11).
          // old[1] (which is currently Feb) should become Index 0.
          const newPd = [];
          for(let i = 0; i < 11; i++) {
              newPd[i] = pd[i+1];
          }
          newPd[11] = pd[0];
          
          await client.query(`UPDATE "Ppa" SET "profileData" = $1::jsonb WHERE id = $2`, [JSON.stringify(newPd), ppa.id]);
          console.log('Reverted profile data successfully.');
          
          // Verify
          const verify = await client.query(`SELECT "profileData" FROM "Ppa" WHERE id = $1`, [ppa.id]);
          const fixedPd = verify.rows[0].profileData;
          fixedPd.forEach((m, idx) => {
             const sum = m.reduce((a,b)=>a+b, 0);
             console.log(`Index ${idx}: ${sum.toFixed(2)} MWh`);
          });
      }
  } else {
      console.log('Not found');
  }
  
  await client.end();
}

query().catch(console.error);
