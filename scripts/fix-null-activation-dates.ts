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
  console.log('Iniciando script de corrección de fechas de alta nulas...');
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        activationDate: null
      },
      select: {
        id: true,
        contractCode: true,
        airtableData: true
      }
    });
    
    console.log(`Encontrados ${contracts.length} contratos con activationDate nulo.`);
    
    let updatedCount = 0;
    
    for (const c of contracts) {
      if (c.airtableData) {
        const airData = typeof c.airtableData === 'string' ? JSON.parse(c.airtableData) : c.airtableData;
        
        // Prioritize fields that indicate the start of the contract
        let dateStr = airData['ALTA COMERCIALIZADORA'] || airData['Fecha firma'] || airData['Fecha Registro'];
        
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          // Check if date is valid
          if (!isNaN(parsedDate.getTime())) {
            await prisma.contract.update({
              where: { id: c.id },
              data: { activationDate: parsedDate }
            });
            updatedCount++;
            if (updatedCount % 50 === 0) {
              console.log(`Progreso: ${updatedCount} contratos actualizados...`);
            }
          } else {
             console.log(`Fecha inválida encontrada para el contrato ${c.contractCode}: ${dateStr}`);
          }
        } else {
          console.log(`No se encontró fecha para el contrato: ${c.contractCode}`);
        }
      }
    }
    
    console.log(`¡Proceso completado! Se han arreglado exitosamente ${updatedCount} contratos.`);
    
  } catch (error) {
    console.error('Error durante la corrección:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
