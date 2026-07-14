const { Client } = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    const csvContent = fs.readFileSync("Z:\\\\Documentos\\\\Escritorio\\\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv", 'utf8');
    const csvData = parse(csvContent, { delimiter: ';', relax_column_count: true });
    
    const dates = [
        { d: '2026-06-05', h: 18, dh: 17, q: 0 },
        { d: '2026-06-22', h: 9, dh: 8, q: 0 },
        { d: '2026-06-03', h: 17, dh: 16, q: 0 },
        { d: '2026-06-11', h: 15, dh: 14, q: 1 },
        { d: '2026-06-25', h: 22, dh: 21, q: 1 }
    ];
    
    for (let spec of dates) {
        const dStr = spec.d.split('-').reverse().join('/');
        let matches = csvData.filter(r => r[8] === dStr && parseInt(r[9]) === spec.dh);
        if (matches.length === 0) continue;
        const row = matches[spec.q];
        
        const provServicio = parseFloat(row[csvData[0].indexOf('servicio')].replace(',', '.'));
        const res = await client.query("SELECT component, \"values\"[" + spec.h + "] as v FROM \"SystemComponentPrice\" WHERE date = '" + spec.d + "'");
        let comps = {};
        for (let r of res.rows) comps[r.component] = r.v;
        
        const total = comps['TOTAL_COMPODEM'];
        const mi = comps['MI'] || 0;
        const secx = comps['SECX'] || 0;
        const rad1 = comps['RAD1'] || 0;
        const sinBalance = total - (mi + secx + rad1);
        const diff = provServicio - sinBalance;
        
        console.log(spec.d + " " + spec.dh + ":");
        console.log("  Prov:", provServicio.toFixed(4));
        console.log("  Calc:", sinBalance.toFixed(4));
        console.log("  Diff:", diff.toFixed(4));
        
        for (let [k, v] of Object.entries(comps)) {
            if (Math.abs(v - diff) < 0.05) {
                console.log("  -> Close match:", k, v.toFixed(4));
            }
        }
    }
}
main().finally(() => client.end());
