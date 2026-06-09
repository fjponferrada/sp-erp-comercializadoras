import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function run() {
  console.log("Fetching USUARIOS from Airtable...");
  let records: any[] = [];
  let offset = '';
  
  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/USUARIOS?${offset ? 'offset=' + offset : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } });
    if (!res.ok) throw new Error("Error fetching Airtable: " + await res.text());
    
    const data = await res.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);
  
  console.log(`Fetched ${records.length} users. Upserting into Prisma...`);

  const brand = await prisma.brand.findFirst();
  if (!brand) throw new Error("No brand found");

  for (const record of records) {
    const f = record.fields;
    let email = f['Email Link'] || f['Email'];
    let name = f['Nombre2'] || f['Nombre 2'] || f['Nombre'] || 'S/D';
    let codigo = f['Código'] || null;
    let canalesLink = f['CANALES LINK'];

    // ONLY import users that belong to a CANAL
    if (!canalesLink || !Array.isArray(canalesLink) || canalesLink.length === 0) continue;

    if (email && typeof email === 'string') {
      try {
        await prisma.user.upsert({
          where: { email: email.trim() },
          update: { name, codigo },
          create: {
            name,
            email: email.trim(),
            password: 'migrated_user',
            role: 'CANAL',
            codigo,
            brandId: brand.id
          }
        });
      } catch (e: any) {
        console.error(`Error upserting ${email}: ${e.message}`);
      }
    }
  }

  console.log("Users imported. Re-assigning leads and contracts...");

  const leads = await prisma.lead.findMany();
  for (const lead of leads) {
    if (lead.airtableData) {
      const airtableData: any = lead.airtableData;
      let emailComercial = airtableData['Email Comercial'];
      if (Array.isArray(emailComercial)) emailComercial = emailComercial[0];
      
      if (emailComercial) {
        const u = await prisma.user.findUnique({ where: { email: emailComercial.trim() } });
        if (u) {
          await prisma.lead.update({ where: { id: lead.id }, data: { userId: u.id } });
        }
      }
    }
  }

  const contracts = await prisma.contract.findMany();
  for (const contract of contracts) {
    if (contract.airtableData) {
      const airtableData: any = contract.airtableData;
      let emailComercial = airtableData['Email Comercial'];
      if (Array.isArray(emailComercial)) emailComercial = emailComercial[0];
      
      if (emailComercial) {
        const u = await prisma.user.findUnique({ where: { email: emailComercial.trim() } });
        if (u) {
          await prisma.contract.update({ where: { id: contract.id }, data: { userId: u.id } });
        }
      }
    }
  }

  console.log("Done!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
