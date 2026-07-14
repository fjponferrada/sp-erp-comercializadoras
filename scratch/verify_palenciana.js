require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sp-erp'
  });
  await client.connect();

  console.log("Verifying Palenciana mismatches...");
  
  const drafts = await client.query(`
    SELECT d."repairData", s.cups, f.id as f1_id, f."fechaInicio", f."fechaFin", f."jsonData"
    FROM "InternalInvoice" d
    JOIN "F1Invoice" f ON d."f1InvoiceId" = f.id
    JOIN "SupplyPoint" s ON f."supplyPointId" = s.id
    JOIN "Contract" con ON f."contractId" = con.id
    JOIN "Client" c ON con."clientId" = c.id
    WHERE d.status = 'REQUIERE_REPARACION' AND c."businessName" ILIKE '%PALENCIANA%'
  `);
  
  for (const row of drafts.rows) {
    let repair = {};
    try { repair = JSON.parse(row.repairData); } catch(e){ repair = row.repairData; }
    
    console.log(`\n===========================================`);
    console.log(`CUPS: ${row.cups.substring(0, 20)}`);
    console.log(`Issue: ${repair.issue}`);
    console.log(`DB fechaInicio (UTC): ${row.fechaInicio ? row.fechaInicio.toISOString() : null}`);
    console.log(`DB fechaFin (UTC): ${row.fechaFin ? row.fechaFin.toISOString() : null}`);
    
    let j = typeof row.jsonData === 'string' ? JSON.parse(row.jsonData) : row.jsonData;
    
    const fData = j?.DatosGeneralesFacturaATR?.DatosFacturaATR?.Periodo;
    if (fData) {
        console.log(`XML Periodo.FechaDesdeFactura: ${fData.FechaDesdeFactura}`);
        console.log(`XML Periodo.FechaHastaFactura: ${fData.FechaHastaFactura}`);
    }

    if (row.cups) {
      const lcs = await client.query(`
        SELECT date, "readings"
        FROM "LoadCurve"
        WHERE cups LIKE $1 AND date >= $2 AND date < $3
        ORDER BY date ASC
      `, [row.cups.substring(0, 20) + '%', row.fechaInicio, row.fechaFin]);
      
      console.log(`Found ${lcs.rows.length} LoadCurve records for this period.`);
      let totalCch = 0;
      for (const lc of lcs.rows) {
         const acts = lc.readings || [];
         for (const a of acts) {
             totalCch += parseFloat(a || 0);
         }
      }
      
      console.log(`CCH Total Energy (sum): ${totalCch / 1000} kWh`);
      
      if (lcs.rows.length > 0) {
          console.log(`First LoadCurve: ${lcs.rows[0].date.toISOString()}`);
          console.log(`Last LoadCurve: ${lcs.rows[lcs.rows.length - 1].date.toISOString()}`);
      }
    }
  }

  await client.end();
}

main().catch(console.error);
