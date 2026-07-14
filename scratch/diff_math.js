const fs = require('fs');
const { parse } = require('csv-parse/sync');

const csvContent = fs.readFileSync("Z:\\\\Documentos\\\\Escritorio\\\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv", 'utf8');
const csvData = parse(csvContent, { delimiter: ';', relax_column_count: true });

const dates = [
    { r: 452, d: '05/06/2026 17:00', sum11: 41.2091 },
    { r: 2048, d: '22/06/2026 08:00', sum11: 27.3405 },
    { r: 256, d: '03/06/2026 16:00', sum11: 19.6946 },
    { r: 1017, d: '11/06/2026 14:15', sum11: 27.0147 },
    { r: 2389, d: '25/06/2026 21:15', sum11: 30.0293 }
];

for (let spec of dates) {
    const row = csvData.find(r => r[0] === spec.r.toString());
    if (!row) continue;
    
    const provServicio = parseFloat(row[csvData[0].indexOf('servicio')].replace(',', '.'));
    const diff = provServicio - spec.sum11;
    
    console.log(spec.d);
    console.log("  Prov:", provServicio.toFixed(4));
    console.log("  Calc:", spec.sum11.toFixed(4));
    console.log("  Diff:", diff.toFixed(4));
}
