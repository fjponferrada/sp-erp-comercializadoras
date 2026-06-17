const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });

  await client.connect();

  const res = await client.query(`
    SELECT "invoiceNumber", "invoiceData", "invoiceType", s.province
    FROM "Invoice" i
    JOIN "SupplyPoint" s ON i."supplyPointId" = s.id
  `);
  let sumByType = {};
  res.rows.forEach(row => {
    const data = typeof row.invoiceData === 'string' ? JSON.parse(row.invoiceData) : row.invoiceData;
    
    let subtotal = parseFloat(String(data['Subtotal 1'] || 0).replace(',', '.'));
    let taxAmount = parseFloat(String(data['Importe Impuesto'] || 0).replace(',', '.'));
    let taxPct = data?.['Impuesto (%)'] ? parseFloat(String(data['Impuesto (%)']).replace(',', '.')) : 5.11;

    let isMinAppliedAir = false;
    const minVal = data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado;
    if (minVal !== undefined && String(minVal).trim() !== '') {
       const flag = String(minVal).trim().toLowerCase();
       isMinAppliedAir = (flag === '0' || flag === 'false');
    }

    const prov = (row.province || '').toLowerCase();
    if (prov === '') return;
    let isExcluded = prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa') || prov.includes('vizcaya') || prov.includes('bizkaia') || prov.includes('navarra') || prov.includes('alava') || prov.includes('álava');

    let dateField = data['Fecha de Emisión'] || data['FechaFactura'] || data['Fecha Factura'];
    if (!dateField) return;
    let d = new Date(dateField);
    if (d < new Date('2026-01-01T00:00:00Z') || d > new Date('2026-03-31T23:59:59Z')) return;

    let invoiceNum = row.invoiceNumber;
    if (!isExcluded && !isMinAppliedAir && taxPct !== 0.5 && taxAmount !== 0) {
        let type = row.invoiceType || 'Unknown';
        if (!sumByType[type]) sumByType[type] = { count: 0, subtotal: 0, tax: 0, nums: new Set(), duplicates: 0 };
        if (sumByType[type].nums.has(invoiceNum)) {
            sumByType[type].duplicates += 1;
            return; // Skip duplicate!
        } else {
            sumByType[type].nums.add(invoiceNum);
        }
        sumByType[type].count += 1;
        sumByType[type].subtotal += subtotal;
        sumByType[type].tax += taxAmount;
    }
  });

  for (let t in sumByType) {
      delete sumByType[t].nums;
  }
  console.log('Sums by Type:', JSON.stringify(sumByType, null, 2));

  await client.end();
}

main().catch(console.error);
