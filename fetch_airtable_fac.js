require('dotenv').config();
async function main() {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C';
  const url = `https://api.airtable.com/v0/${BASE_ID}/FACTURAS?filterByFormula={Numero Factura}='A260511025'`;
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + API_KEY } });
  const data = await res.json();
  if(data.records && data.records.length > 0) {
    const f = data.records[0].fields;
    console.log('PDF:', f['PDF']);
    console.log('XML:', f['XML']);
    console.log('ID Google Drive PDF:', f['ID Google Drive PDF']);
  } else {
    console.log('Not found');
  }
}
main();
