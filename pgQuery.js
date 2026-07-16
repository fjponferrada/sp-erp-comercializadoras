const { Client } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await client.connect();
  
  const res = await client.query(`
      SELECT SUM((p->>'ValorEnergiaActiva')::numeric) as total_energia
      FROM "F1Invoice" f
      CROSS JOIN jsonb_array_elements(
        CASE 
          WHEN jsonb_typeof(f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'->'Periodo') = 'array' 
          THEN f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'->'Periodo'
          ELSE '[]'::jsonb
        END
      ) as p
      WHERE NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."f1InvoiceId" = f.id)
  `);
  console.log(res.rows);
  
  await client.end();
}
main().catch(console.error);
