const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });
  
  await client.connect();
  
  console.log("--- DEBUG CONTRATO ERANOVUM ---");
  const contracts = await client.query(`SELECT id, "pricingModel", "airtableData", fee FROM "Contract" WHERE "airtableData"::text ILIKE '%ERANOVUM%' LIMIT 5`);
  for (const c of contracts.rows) {
    let air = c.airtableData || {};
    if (typeof air === 'string') {
      try { air = JSON.parse(air); } catch(e){}
    }
    console.log(`Contract ID: ${c.id}`);
    console.log(`Pricing Model: ${c.pricingModel}`);
    console.log(`AirTable FIJO/INDEX: ${air['FIJO / INDEX']}`);
    console.log(`Product Name: ${air['PRODUCTO (del CONTRATO)'] || air['PRODUCTO']}`);
  }

  console.log("\n--- DEBUG DESCUADRES (F1 vs CCH) ---");
  // Get the drafts that need repair
  const drafts = await client.query(`
    SELECT d."f1InvoiceId", d."repairData", c."businessName" as client_name, s.cups, f."fechaInicio", f."fechaFin"
    FROM "InternalInvoice" d
    JOIN "F1Invoice" f ON d."f1InvoiceId" = f.id
    LEFT JOIN "SupplyPoint" s ON f."supplyPointId" = s.id
    LEFT JOIN "Contract" con ON f."contractId" = con.id
    LEFT JOIN "Client" c ON con."clientId" = c.id
    WHERE d.status = 'REQUIERE_REPARACION'
    LIMIT 10
  `);
  
  for (const row of drafts.rows) {
    if (!row.repairData) continue;
    let repair = {};
    try { repair = JSON.parse(row.repairData); } catch(e){ repair = row.repairData; }
    
    console.log(`\nClient: ${row.client_name} - CUPS: ${row.cups.substring(0, 20)}`);
    console.log(`Issue: ${repair.issue}`);
    console.log(`F1 Dates: ${row.fechaInicio} to ${row.fechaFin}`);
    
    // Check load curves in DB
    const lcs = await client.query(`
      SELECT date
      FROM "LoadCurve"
      WHERE cups LIKE $1 AND date >= $2 AND date < $3
      ORDER BY date ASC
    `, [row.cups.substring(0, 20) + '%', row.fechaInicio, row.fechaFin]);
    
    console.log(`Found ${lcs.rows.length} LoadCurve records for this period.`);
    if (lcs.rows.length > 0) {
      console.log(`First date: ${lcs.rows[0].date}, Last date: ${lcs.rows[lcs.rows.length - 1].date}`);
      
      // Calculate missing days
      const start = new Date(row.fechaInicio);
      const end = new Date(row.fechaFin);
      const expectedDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      console.log(`Expected days: ${expectedDays}, Missing days: ${expectedDays - lcs.rows.length}`);
    }
  }

  await client.end();
}

main().catch(console.error);
