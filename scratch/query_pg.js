const { Client } = require('pg');

const dbUrl = "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true";

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT 
        c.id as "contractId",
        c.tipo as "contractTipo",
        c."tipoC2",
        c."airtableData" as "contractAirtable",
        c."clientId",
        cl."clientType",
        cl."billingAddress",
        cl."billingStreet",
        cl."billingNumber",
        sp.tariff as "supplyPointTariff",
        p.tariff as "productTariff",
        l."contractData" as "leadContractData"
      FROM "Contract" c
      LEFT JOIN "Client" cl ON c."clientId" = cl.id
      LEFT JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      LEFT JOIN "Product" p ON c."productId" = p.id
      LEFT JOIN "Lead" l ON c."id" = l."contractId"
      WHERE c."contractCode" = 'PRPR2510301219NM0F'
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
