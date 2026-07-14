const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });
client.connect().then(() => {
    return client.query(`SELECT component, "values"[18] as v17 FROM "SystemComponentPrice" WHERE date = '2026-06-05' AND component IN ('MI', 'SECX', 'RAD1', 'FNA3', 'PM', 'EXD')`);
}).then(res => {
    console.table(res.rows);
    client.end();
}).catch(e => console.error(e));
