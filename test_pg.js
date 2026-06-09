require('dotenv').config(); 
const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); 
pool.query('SELECT "businessName", "vatNumber", "dNINIFTitular", "sipsCnae", "tipodepersona" FROM "Lead" WHERE "airtableId" IS NULL LIMIT 20')
.then(r => console.log(JSON.stringify(r.rows, null, 2)))
.finally(() => pool.end());
