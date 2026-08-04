import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log('Buscando contratos FINALIZADOS o BAJAS...');
  const res = await client.query(`
    SELECT id, "supplyPointId" 
    FROM "Contract"
    WHERE status IN ('BAJA', 'Baja', 'FINALIZADO', 'Finalizado') 
      AND "bajaProcess" IS NULL
  `);
  
  const contracts = res.rows;
  console.log(`Se encontraron ${contracts.length} contratos candidatos a ser actualizados.`);
  let updatedCount = 0;

  for (const c of contracts) {
    const evRes = await client.query(`
      SELECT "procesoBase", "paso"
      FROM "SwitchingEvent"
      WHERE "supplyPointId" = $1
        AND "procesoBase" IN ('B1', 'B2', 'E1', 'E2', 'T1', 'C1', 'C2', 'M1')
        AND "paso" IN ('02', '04', '05', '06')
      ORDER BY "createdAt" DESC
    `, [c.supplyPointId]);

    const events = evRes.rows;

    if (events.length > 0) {
      let selectedEvent = null;
      for (const ev of events) {
        if (ev.procesoBase === 'T1' && ev.paso === '06') {
          selectedEvent = ev; break;
        }
        if (['C1', 'C2'].includes(ev.procesoBase) && ev.paso === '06') {
          selectedEvent = ev; break;
        }
        if (['B1', 'B2', 'E1'].includes(ev.procesoBase) && ev.paso === '02') {
          selectedEvent = ev; break;
        }
        if (ev.procesoBase === 'E2' && ev.paso === '05') {
          selectedEvent = ev; break;
        }
      }

      if (selectedEvent) {
        await client.query(`
          UPDATE "Contract"
          SET "bajaProcess" = $1
          WHERE id = $2
        `, [selectedEvent.procesoBase, c.id]);
        updatedCount++;
        console.log(`Contrato ${c.id} marcado como dado de baja por: ${selectedEvent.procesoBase}`);
      }
    }
  }

  console.log(`Terminado. Se actualizaron ${updatedCount} contratos con el proceso de origen.`);
  await client.end();
}

main().catch(console.error);
