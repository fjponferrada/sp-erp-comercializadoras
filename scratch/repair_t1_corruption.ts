import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log('Buscando casos de corrupción: versión antigua en ACTIVO y versión más reciente en FINALIZADO...');
  const res = await client.query(`
    SELECT c1.id AS active_id, c1.version AS active_version, c1."contractCode", 
           c2.id AS finalized_id, c2.version AS finalized_version, c2."bajaProcess", c2."internalComments", c2."terminationDate"
    FROM "Contract" c1
    JOIN "Contract" c2 ON c1."contractCode" = c2."contractCode"
    WHERE c1.status = 'ACTIVO'
      AND c2.status = 'FINALIZADO'
      AND c2.version > c1.version
  `);
  
  console.log(`Encontrados ${res.rows.length} casos de corrupción.`);
  for (const row of res.rows) {
    console.log(`- Contrato ${row.contractCode}: Versión ${row.active_version} sigue ACTIVO, pero Versión ${row.finalized_version} está FINALIZADA (bajaProcess: ${row.bajaProcess}).`);
    
    // Auto-repair logic
    // 1. Move the finalized status and dates to the ACTIVO version
    await client.query(`
      UPDATE "Contract"
      SET status = 'FINALIZADO',
          "terminationDate" = $1,
          "bajaProcess" = $2,
          "internalComments" = COALESCE("internalComments", '') || E'\n[Reparación Automática] Finalizado por proceso ${row.bajaProcess} traspasado desde la versión ${row.finalized_version}'
      WHERE id = $3
    `, [row.terminationDate, row.bajaProcess, row.active_id]);

    // 2. Reject the newer version (since it was just TRAMITANDO and never activated)
    await client.query(`
      UPDATE "Contract"
      SET status = 'RECHAZADO',
          "terminationDate" = NULL,
          "bajaProcess" = NULL,
          "internalComments" = COALESCE("internalComments", '') || E'\n[Reparación Automática] Rechazado porque se recibió baja por switching antes de su activación.'
      WHERE id = $1
    `, [row.finalized_id]);
    console.log(`  -> Reparado: v${row.active_version} finalizada, v${row.finalized_version} rechazada.`);
  }

  await client.end();
}

main().catch(console.error);
