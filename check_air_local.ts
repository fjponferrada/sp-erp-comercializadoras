import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contract.findFirst({
    where: { 
      airtableData: { not: null },
      pricingModel: { in: ['FIJO', 'Fijo', 'FIXED'] }
    }
  });

  if (c && c.airtableData) {
    console.log("KEYS:", Object.keys(c.airtableData as any));
    console.log("VALUES:", c.airtableData);
  } else {
    console.log("No fixed contract with airtableData found.");
  }
}

main().finally(() => prisma.$disconnect());
