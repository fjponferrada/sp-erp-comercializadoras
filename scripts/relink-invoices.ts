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
  console.log('Iniciando re-vinculación de facturas...');
  try {
    // Find all invoices linked to rejected/draft contracts or orphans
    const invoicesToFix = await prisma.invoice.findMany({
      where: {
        OR: [
          { contractId: null },
          {
            contract: {
              status: {
                in: ['RECHAZADO', 'RECHAZO_DISTRIBUIDORA', 'BORRADOR', 'TRAMITANDO', 'DRAFT', 'Borrador', 'ACEPTADO']
              }
            }
          }
        ]
      },
      include: {
        contract: {
          include: { supplyPoint: true }
        }
      }
    });
    
    console.log(`Encontradas ${invoicesToFix.length} facturas para re-vincular.`);
    
    let relinkedCount = 0;
    
    for (const inv of invoicesToFix) {
      // If orphaned, we might not know the cups directly unless we extract it from invoice data
      // Let's assume for now we are mostly fixing invoices linked to RECHAZADO contracts which have a contract.supplyPoint
      if (inv.contract && inv.contract.supplyPoint) {
        const cups = inv.contract.supplyPoint.cups;
        
        // Find the ACTIVO or FINALIZADO contract for this CUPS
        const validContract = await prisma.contract.findFirst({
          where: {
            supplyPoint: { cups },
            status: { in: ['ACTIVO', 'FINALIZADO', 'Finalizado', 'Activo'] }
          },
          orderBy: {
            activationDate: 'desc'
          }
        });
        
        if (validContract) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { contractId: validContract.id }
          });
          relinkedCount++;
        } else {
          console.log(`No se encontró un contrato válido para la factura ${inv.invoiceNumber} (CUPS: ${cups})`);
        }
      } else {
        // Orphaned invoice without contract
        console.log(`Factura huérfana sin contrato: ${inv.invoiceNumber}. Requiere revisión manual si no tiene datos de CUPS.`);
        // Could potentially parse `airtableData` or `xmlData` if it existed, but let's just log it for now
      }
    }
    
    console.log(`¡Proceso completado! Se han re-vinculado ${relinkedCount} facturas.`);
    
  } catch (error) {
    console.error('Error durante la re-vinculación:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
