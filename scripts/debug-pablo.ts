import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function run() {
  const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/USUARIOS?filterByFormula=" + encodeURIComponent("NOT({CANALES LINK}='')");
  const res = await fetch(url, { headers: { Authorization: "Bearer " + AIRTABLE_API_KEY } });
  const data = await res.json();
  const pablo = data.records.find((r: any) => {
      const email = r.fields['Email'] || r.fields['Email Link'];
      const emStr = Array.isArray(email) ? email[0] : email;
      return emStr && emStr.toString().toLowerCase().includes('pabloremacha');
  });
  console.log(JSON.stringify(pablo, null, 2));
}

run().catch(console.error);
