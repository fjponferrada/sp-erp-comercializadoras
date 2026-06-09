require('dotenv').config(); 
const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); 
pool.query(`SELECT * FROM "Client" WHERE "businessName" LIKE '%RAFAEL ALBERTO%' LIMIT 1`)
.then(r => console.log(JSON.stringify(r.rows, null, 2)))
.finally(() => pool.end());
