const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});

async function run() {
  await client.connect();
  const cRes = await client.query('SELECT id, status, "contractCode", version, "activationDate", "terminationDate", p1p, p2p, p3p, p4p, p5p, p6p FROM "Contract" WHERE "supplyPointId" = (SELECT id FROM "SupplyPoint" WHERE cups = \'ES0031105131691001XN0F\')');
  console.log("Contracts for ES0031105131691001XN0F:");
  console.table(cRes.rows);
  
  const fRes = await client.query('SELECT f1.id, f1."contractId", f1."fechaInicio", f1."fechaFin" FROM "F1Invoice" f1 JOIN "SupplyPoint" s ON f1."supplyPointId" = s.id WHERE s.cups = \'ES0031105131691001XN0F\'');
  console.log("F1 invoices for ES0031105131691001XN0F:");
  console.table(fRes.rows);
  
  await client.end();
}

run().catch(console.error);
