const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

client.connect().then(async () => {
    const res = await client.query('SELECT DISTINCT concept FROM "RegulatedCost"');
    console.log(res.rows);
}).finally(() => client.end());
