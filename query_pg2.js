const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require' });
client.connect();
client.query('SELECT name, type FROM "Product" WHERE name ILIKE \'%personalizad%\' OR name ILIKE \'%pers%\' OR name ILIKE \'%flex%\'').then(res => {
  console.table(res.rows);
  client.end();
});
