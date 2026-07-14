import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { cups: 'ES0031104045598001JV0F' }
  });
  if (lead) {
    const data = lead.airtableData as any;
    console.log("Estimated MWh in DB:", lead.estimatedMWh);
    console.log("CONSUMO ANUAL KWH in Airtable:", data['CONSUMO ANUAL KWH']);
    console.log("Other Airtable fields related to consumo:", Object.keys(data).filter(k => k.toLowerCase().includes('consumo')).map(k => `${k}: ${data[k]}`));
    console.log("Bolsillo solar:", data['BOLSILLO SOLAR']);
    console.log("Envio de factura:", data['Envío de factura'] || data['TIPO_ENVIO_FACTURA_RENOV'] || data['Tipo de envío de factura']);
    console.log("All keys containing envio or factura:", Object.keys(data).filter(k => k.toLowerCase().includes('env') || k.toLowerCase().includes('factura')).map(k => k));
  } else {
    console.log("Not found in leads");
  }
}
main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
