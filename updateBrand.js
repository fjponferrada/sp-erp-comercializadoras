const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query(`
    UPDATE "Brand"
    SET 
      "address" = 'Calle del Brezo, 6, 14012 (Córdoba)',
      "email" = 'clientes@aed-energia.com',
      "contactPerson" = 'Fco Javier Ponferrada',
      "phone" = '900525826',
      "codigoMarca" = 'AED'
    WHERE "name" LIKE '%AED%'
  `);
  console.log('Update brand done');
}

main().catch(console.error).finally(() => pool.end());
