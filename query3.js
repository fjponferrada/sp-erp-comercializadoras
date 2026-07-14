const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
});
client.connect();
client.query("SELECT date, cierre, \"jsonData\" FROM \"ReganecuData\" WHERE total = true AND date >= '2026-05-01' AND date < '2026-06-01';", (err, res) => {
  if (err) throw err;
  res.rows.forEach(r => {
    console.log(r.date.toISOString(), r.cierre, Object.keys(r.jsonData));
  });
  client.end();
});
