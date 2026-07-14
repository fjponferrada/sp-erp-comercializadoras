const { Client } = require('pg');
const { fromZonedTime } = require('date-fns-tz');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const parseAndShiftDate = (dStr, shiftDays = 0) => {
    if (!dStr) return undefined;
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const d = parseInt(parts[2]) + shiftDays;
      
      const overflowDate = new Date(Date.UTC(y, m - 1, d));
      const dateStr = overflowDate.toISOString().substring(0, 10) + 'T00:00:00';
      
      return fromZonedTime(dateStr, 'Europe/Madrid');
    }
    return undefined;
  };

  const res = await client.query(`
    SELECT id, "jsonData"
    FROM "F1Invoice"
  `);

  let count = 0;
  for (const row of res.rows) {
    const f = row.jsonData;
    if (!f) continue;

    const dGen = f.DatosGeneralesFacturaATR || {};
    const dFact = dGen.DatosFacturaATR || f.DatosFacturaATR || {};
    
    const fechaIniStr = dFact.Periodo?.FechaDesdeFactura || dFact.FechaInicioPeriodo;
    const fechaFinStr = dFact.Periodo?.FechaHastaFactura || dFact.FechaFinPeriodo;

    if (fechaIniStr && fechaFinStr) {
      const ini = parseAndShiftDate(fechaIniStr, 1);
      const fin = parseAndShiftDate(fechaFinStr, 1);
      
      if (ini && fin) {
        await client.query(`
          UPDATE "F1Invoice"
          SET "fechaInicio" = $1, "fechaFin" = $2
          WHERE id = $3
        `, [ini, fin, row.id]);
        count++;
      }
    }
  }

  console.log(`Updated ${count} F1 Invoices with shiftDays=1 for both dates.`);
  await client.end();
}

main().catch(console.error);
