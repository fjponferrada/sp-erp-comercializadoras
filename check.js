const {Client} = require('pg');
require('dotenv').config();
const c = new Client({connectionString: process.env.DATABASE_URL});
c.connect().then(() => 
  c.query('SELECT "invoiceNumber" FROM "PenaltyInvoice" WHERE "invoiceNumber" LIKE \'A26PEN%\' ORDER BY "invoiceNumber" DESC LIMIT 15')
    .then(res => {
       console.log(res.rows.map(r=>r.invoiceNumber)); 
       c.end();
    })
);
