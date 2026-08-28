const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./prisma/dev.db');

db.all("SELECT * FROM Contract WHERE contractCode = 'AEDJP221171941A0F'", (err, rows) => {
  if (err) console.error(err);
  else {
    const c = rows[0];
    console.log(c);
  }
  db.close();
});
