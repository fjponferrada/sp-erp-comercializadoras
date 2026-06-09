const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const res = await pool.query(`SELECT * FROM "Invoice" WHERE "invoiceNumber" = 'A260511025'`);
  const inv = res.rows[0];
  if (!inv) { console.log('Not found'); await pool.end(); return; }
  
  const relevantKeys = [
    'desde', 'hasta', 'desdeEA', 'hastaEA', 'procedenciaDesde', 'procedenciaHasta',
    'atrComer', 'dISTRIBUIDORA', 'nombreDistribuidora', 'p1c', 'p1e', 'p1p', 'p1PotenciaContratada',
    'potenciaaFacturarP1', 'dias', 'margin', 'margenFactura', 'taxAmount', 'taxPercentage', 'importeIva', 'iva',
    'pDF', 'xML', 'pdfUrl', 'iDGoogleDrivePDF', 'iDGoogleDriveXML', 'p1E', 'p1P'
  ];
  
  const output = {};
  for (const k of relevantKeys) {
    if (inv[k] !== undefined) output[k] = inv[k];
  }
  console.log(output);
  await pool.end();
}
main();
