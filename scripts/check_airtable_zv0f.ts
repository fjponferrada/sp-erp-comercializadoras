import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

async function check() {
    const records = await base('CONTRATOS').select({
        filterByFormula: 'SEARCH("ZV0F", CUPS)'
    }).all();
    
    console.log(`Found ${records.length} records in CONTRATOS with ZV0F`);
    for (const r of records) {
        console.log(`Contract: ${r.fields['CONTRATO']} - Status: ${r.fields['Estado']} - Titular: ${r.fields['Nombre completo Titular']} - CUPS: ${r.fields['CUPS']}`);
    }
}

check();
