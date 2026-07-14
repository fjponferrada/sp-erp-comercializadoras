import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { 
        contract: { contractCode: 'PRPR24618946NC0F' } 
    },
    include: { contract: true }
  });
  if (lead) {
    const data = lead.airtableData as any;
    console.log("Found Lead for Contract:", lead.contract?.contractCode);
    console.log("Estimated MWh in DB:", lead.estimatedMWh);
    
    // Dump all keys that contain 'consumo' or 'kwh' or 'anual'
    const keys = Object.keys(data).filter(k => 
        k.toLowerCase().includes('consumo') || 
        k.toLowerCase().includes('kwh') || 
        k.toLowerCase().includes('anual')
    );
    
    console.log("Raw fields from Airtable:");
    keys.forEach(k => {
        console.log(`  "${k}":`, data[k]);
    });
  } else {
    console.log("Lead not found for contractCode PRPR24618946NC0F");
  }
}
main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
