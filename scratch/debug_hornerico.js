const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });
  
  await client.connect();
  
  const f1s = await client.query(`
    SELECT f.id, f."fechaInicio", f."fechaFin", s.cups, f."jsonData", d.status, d."repairData"
    FROM "F1Invoice" f
    JOIN "InternalInvoice" d ON f.id = d."f1InvoiceId"
    JOIN "SupplyPoint" s ON f."supplyPointId" = s.id
    JOIN "Contract" c ON f."contractId" = c.id
    JOIN "Client" cl ON c."clientId" = cl.id
    WHERE cl."businessName" ILIKE '%HORNERICO%' AND d.status = 'REQUIERE_REPARACION'
  `);

  console.log(`Found ${f1s.rows.length} invoices for SAT HORNERICO CUPS.`);
  for (const f of f1s.rows) {
    console.log(`\nID: ${f.id} | Status: ${f.status} | Dates: ${f.fechaInicio} to ${f.fechaFin}`);
    console.log(`RepairData:`, f.repairData);
    
    let j = {};
    if (typeof f.jsonData === 'string') {
      try { j = JSON.parse(f.jsonData); } catch(e){}
    } else {
      j = f.jsonData;
    }
    
    console.log(`XML Keys:`, Object.keys(j));
    if (j.Cargos) console.log(`Cargos:`, JSON.stringify(j.Cargos, null, 2));
    if (j.TerminoEnergia) console.log(`TerminoEnergia:`, JSON.stringify(j.TerminoEnergia, null, 2));
  }

  await client.end();
}
main().catch(console.error);
