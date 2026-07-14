const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });
  
  await client.connect();
  
  console.log("\n--- DEBUG NUEVOS ERRORES (F1 vs CCH) ---");
  const drafts = await client.query(`
    SELECT c."businessName" as client_name, s.cups, f."fechaInicio", f."fechaFin", f."jsonData"
    FROM "F1Invoice" f
    JOIN "SupplyPoint" s ON f."supplyPointId" = s.id
    JOIN "Contract" con ON f."contractId" = con.id
    JOIN "Client" c ON con."clientId" = c.id
    WHERE c."businessName" ILIKE '%BIRKA%' OR c."businessName" ILIKE '%PALENCIANA%'
    LIMIT 10
  `);
  
  for (const row of drafts.rows) {
    console.log(`\nClient: ${row.client_name}`);
    console.log(`DB fechaInicio (UTC): ${row.fechaInicio ? row.fechaInicio.toISOString() : null}`);
    console.log(`DB fechaFin (UTC): ${row.fechaFin ? row.fechaFin.toISOString() : null}`);
    
    let j = typeof row.jsonData === 'string' ? JSON.parse(row.jsonData) : row.jsonData;
    
    const fData = j?.DatosGeneralesFacturaATR?.DatosFacturaATR?.Periodo;
    if (fData) {
        console.log(`XML Periodo.FechaDesdeFactura: ${fData.FechaDesdeFactura}`);
        console.log(`XML Periodo.FechaHastaFactura: ${fData.FechaHastaFactura}`);
    }
  }

  await client.end();
}

main().catch(console.error);
