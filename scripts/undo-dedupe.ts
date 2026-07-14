import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        supplyPoint: {
          include: { client: true }
        }
      }
    });
    
    let restoredCount = 0;
    
    for (const c of contracts) {
      if (c.airtableData && c.supplyPoint && c.supplyPoint.client) {
        const airData = typeof c.airtableData === 'string' ? JSON.parse(c.airtableData) : c.airtableData;
        const cifLink = airData['Copia de CIF link'] || airData['NIF Contacto'];
        
        if (cifLink && c.supplyPoint.client.vatNumber !== cifLink) {
          const trueClient = await prisma.client.findFirst({
            where: { vatNumber: cifLink }
          });
          
          if (trueClient) {
            // Check if SupplyPoint already exists for this client
            let existingSp = await prisma.supplyPoint.findUnique({
              where: {
                cups_clientId: { cups: c.supplyPoint.cups, clientId: trueClient.id }
              }
            });
            
            if (!existingSp) {
              existingSp = await prisma.supplyPoint.create({
                data: {
                  cups: c.supplyPoint.cups,
                  address: c.supplyPoint.address,
                  city: c.supplyPoint.city,
                  postalCode: c.supplyPoint.postalCode,
                  province: c.supplyPoint.province,
                  tariff: c.supplyPoint.tariff,
                  distributor: c.supplyPoint.distributor,
                  annualConsumption: c.supplyPoint.annualConsumption,
                  p1c: c.supplyPoint.p1c,
                  p2c: c.supplyPoint.p2c,
                  clientId: trueClient.id
                }
              });
            }
            
            // Relink the contract
            await prisma.contract.update({
              where: { id: c.id },
              data: { supplyPointId: existingSp.id }
            });
            
            restoredCount++;
          }
        }
      }
    }
    
    console.log(`Restored ${restoredCount} SupplyPoint records for contracts mapped to the wrong client.`);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
