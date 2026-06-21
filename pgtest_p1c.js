const { Client } = require('pg');
const c = new Client('postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true');
c.connect().then(() => c.query("SELECT \"invoiceData\" FROM \"Invoice\" WHERE \"invoiceNumber\"='A260614651'"))
.then(r => { 
  if(r.rows.length > 0) {
    const d = r.rows[0].invoiceData;
    console.log("P1C:", d['P1 Potencia Contratada']);
    console.log("P2C:", d['P2 Potencia Contratada']);
  }
  c.end(); 
});
