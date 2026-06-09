import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

async function test() {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  let records: any[] = [];
  let offset = '';
  
  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/USUARIOS?${offset ? 'offset=' + offset : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    if (!res.ok) {
      console.error('Failed to fetch:', await res.text());
      break;
    }
    const data = await res.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);
  
  console.log(`Found ${records.length} users.`);
  fs.writeFileSync('usuarios.json', JSON.stringify(records, null, 2));
  
  const pablo = records.find((r: any) => r.fields['Email Link'] === 'pabloremacha@aenergetica.es' || r.fields['Email'] === 'pabloremacha@aenergetica.es');
  console.log("Pablo:", pablo?.fields);
  
  const antonio = records.find((r: any) => JSON.stringify(r.fields).toLowerCase().includes('yeguas') || JSON.stringify(r.fields).toLowerCase().includes('antonio y'));
  console.log("Antonio Yeguas:", antonio?.fields);
}
test().catch(console.error);
