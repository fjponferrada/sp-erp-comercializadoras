const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query(`
    UPDATE "Company"
    SET 
      "address" = 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
      "email" = 'fjponferrada@aed-energia.com',
      "contactPerson" = 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
      "phone" = '900525826',
      "cif" = 'B10915544',
      "ordenCnmc" = 'RS-950',
      "fechaActivacionCnmc" = '2022-10-25',
      "fechaActivacionIsm" = '2022-11-01',
      "representadoPor" = 'AED',
      "codigoRee" = '1713',
      "codigoAcer" = 'Código ACER',
      "unidadOfertaOmie" = 'AEDEC01',
      "remit" = 'AED',
      "codigoSujetoMercado" = '18X00000000000IA',
      "empresaVisible" = true,
      "emisionFacturasCliente" = true
    WHERE "name" LIKE '%AED%'
  `);
  console.log('Update done');
}

main().catch(console.error).finally(() => pool.end());
