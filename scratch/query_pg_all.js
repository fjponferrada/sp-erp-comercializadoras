const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });
client.connect().then(() => {
    return client.query(`SELECT component, "values"[18] as v17 FROM "SystemComponentPrice" WHERE date = '2026-06-05'`);
}).then(res => {
    let sorted = res.rows.filter(r => Math.abs(r.v17) > 0.001).sort((a,b) => b.v17 - a.v17);
    console.table(sorted);
    client.end();
}).catch(e => console.error(e));
