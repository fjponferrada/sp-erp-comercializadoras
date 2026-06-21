const { Client } = require('pg');
const c = new Client('postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true');
c.connect().then(() => c.query("SELECT \"invoiceData\" FROM \"Invoice\" WHERE \"invoiceNumber\"='A260614802'"))
.then(r => { console.log(JSON.stringify(r.rows[0].invoiceData, null, 2)); c.end(); });
