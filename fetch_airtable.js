require('dotenv').config();
const fetch = require('node-fetch'); // wait, I can use built-in fetch in node 24

async function main() {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C';

    const url = 'https://api.airtable.com/v0/' + BASE_ID + '/CONTRATOS/rec00UENX4cl5qGby';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + API_KEY } });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
