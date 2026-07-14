import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
console.log("Using Connection String:", connectionString ? connectionString.substring(0, 30) + "..." : "NONE");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Check contracts
    const { rows: c1Rows } = await client.query(`SELECT id, "internalCode", status, "activationDate" FROM "Contract" WHERE "internalCode" = 'NUEB26331151QW0F'`);
    const { rows: c2Rows } = await client.query(`SELECT id, "internalCode", status, "activationDate", "supplyPointId" FROM "Contract" WHERE "internalCode" = 'NUFR26331151QW0F'`);
    const { rows: clientB88Rows } = await client.query(`SELECT id, "documentNumber" FROM "Client" WHERE "documentNumber" = 'B88759287'`);

    if (c1Rows.length > 0 && c2Rows.length > 0) {
      const c1 = c1Rows[0];
      const c2 = c2Rows[0];
      console.log("V1 found:", c1.internalCode);
      console.log("V2 found:", c2.internalCode);

      const v1ActDate = new Date('2026-04-28T00:00:00Z');
      const v1TermDate = new Date(c2.activationDate || '2026-06-23T00:00:00Z');
      v1TermDate.setDate(v1TermDate.getDate() - 1);

      await client.query(`UPDATE "Contract" SET status = 'FINALIZADO', "activationDate" = $1, "terminationDate" = $2 WHERE id = $3`, [v1ActDate, v1TermDate, c1.id]);
      console.log("V1 updated!");

      if (clientB88Rows.length > 0) {
        const clientB88 = clientB88Rows[0];
        console.log("Client B88 found:", clientB88.id);

        await client.query(`UPDATE "Contract" SET "clientId" = $1 WHERE id = $2`, [clientB88.id, c2.id]);
        console.log("V2 linked to Client B88");

        if (c2.status === 'ACTIVO' || c2.status === 'ACTIVE' || c2.status === 'Activo') {
          await client.query(`UPDATE "SupplyPoint" SET "clientId" = $1 WHERE id = $2`, [clientB88.id, c2.supplyPointId]);
          console.log("SupplyPoint linked to Client B88");
        }
      } else {
        console.log("Client B88759287 not found in DB.");
      }
    } else {
      console.log("Missing contracts!");
    }
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
