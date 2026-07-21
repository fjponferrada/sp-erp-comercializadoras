const { Client } = require('pg');
const dbUrl = "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true";

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const res = await client.query(`SELECT * FROM "Contract" WHERE "contractCode" = 'PRPR2510301219NM0F'`);
    if (res.rows.length > 0) {
      console.log(JSON.stringify(res.rows[0], null, 2));
    }
    
    // Check ContractModification just in case
    const modRes = await client.query(`SELECT * FROM "ContractModification" WHERE "contractId" = $1`, [res.rows[0].id]);
    if (modRes.rows.length > 0) {
      console.log("Found ContractModification:");
      console.log(JSON.stringify(modRes.rows, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
