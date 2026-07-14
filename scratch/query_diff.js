const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });
client.connect().then(async () => {
    const dates = [
        ['2026-06-05', 18],
        ['2026-06-22', 9],
        ['2026-06-03', 17],
        ['2026-06-11', 15],
        ['2026-06-25', 22]
    ];
    for (const [d, h] of dates) {
        const res = await client.query("SELECT component, \"values\"[" + h + "] as v FROM \"SystemComponentPrice\" WHERE date = '" + d + "'");
        const row = { date: d, h };
        for (const r of res.rows) {
            row[r.component] = r.v;
        }
        console.log(d + ' ' + h + ': BS3=' + row['BS3'] + ' PM=' + row['PM'] + ' FNA3=' + row['FNA3'] + ' RT4=' + row['RT4']);
    }
}).then(() => client.end());
