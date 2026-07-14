require('dotenv').config();
const { Pool } = require('pg');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C';

async function fetchAirtable(table, recordId) {
    const url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + encodeURIComponent(table) + '?filterByFormula={Numero Factura}=\'' + recordId + '\'';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + API_KEY } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.records && data.records.length > 0 ? data.records[0] : null;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: invoices } = await pool.query('SELECT id, "invoiceNumber" FROM "Invoice"');
  console.log(`Syncing docs for ${invoices.length} invoices...`);
  
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (!inv.invoiceNumber) continue;
    
    try {
        const airtableRecord = await fetchAirtable('FACTURAS', inv.invoiceNumber);
        if (airtableRecord && airtableRecord.fields) {
        let pDF = null;
        let xML = null;
        
        const pdfField = airtableRecord.fields['PDF'];
        if (Array.isArray(pdfField) && pdfField.length > 0 && pdfField[0].url) {
            pDF = pdfField[0].url;
        }
        
        const xmlField = airtableRecord.fields['XML'];
        if (Array.isArray(xmlField) && xmlField.length > 0 && xmlField[0].url) {
            xML = xmlField[0].url;
        }
        
        if (pDF || xML) {
            await pool.query('UPDATE "Invoice" SET "pDF" = $1, "xML" = $2 WHERE id = $3', [pDF, xML, inv.id]);
            console.log(`Updated ${inv.invoiceNumber}: PDF=${!!pDF}, XML=${!!xML} (${i+1}/${invoices.length})`);
        }
        }
    } catch(e) {
        console.error("Error with " + inv.invoiceNumber, e);
    }
  }
  console.log('Done!');
  await pool.end();
}

main();
