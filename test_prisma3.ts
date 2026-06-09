import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { prisma } from './src/lib/prisma';
import fs from 'fs';

async function run() {
  try {
    const l = await prisma.lead.findFirst({
      where: { airtableId: { not: null } }
    });
    fs.writeFileSync('output.json', JSON.stringify(l, null, 2));
  } catch (err: any) {
    fs.writeFileSync('output.json', err.message || String(err));
  }
}
run().finally(() => process.exit(0));
