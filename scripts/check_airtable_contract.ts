import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

async function check() {
    const r = await base('CONTRATOS').find('recoxRRHWL8tS3YVy');
    console.log("CONTRATO:");
    console.log(`- CIF link:`, r.fields['CIF link']);
    console.log(`- Titular:`, r.fields['Nombre completo Titular']);
}

check();
