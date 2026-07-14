const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  await client.connect();

  const finalNumber = 'A260615994';
  const finalRes = await client.query('SELECT "invoiceData" FROM "Invoice" WHERE "invoiceNumber" = $1', [finalNumber]);
  
  if (finalRes.rows.length > 0) {
      console.log('invoiceData para', finalNumber, ':', JSON.stringify(finalRes.rows[0].invoiceData, null, 2));
  }

  await client.end();
}

main().catch(console.error);
