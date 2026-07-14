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
  console.log('Iniciando re-vinculación de F1Invoices...');
  try {
    const f1s = await prisma.f1Invoice.findMany({
      include: {
        supplyPoint: {
          include: { contracts: { orderBy: { createdAt: 'desc' } } }
        },
        contract: true
      }
    });

    console.log(`Analizando ${f1s.length} facturas F1...`);
    let relinkedCount = 0;

    for (const f1 of f1s) {
      const sp = f1.supplyPoint;
      if (!sp) continue;

      let newContractId = null;

      const baseCups = sp.cups.substring(0, 20);
      const sps = await prisma.supplyPoint.findMany({
        where: { cups: { startsWith: baseCups } },
        include: { contracts: { orderBy: { createdAt: 'desc' } } }
      });
      const allContracts = sps.flatMap(s => s.contracts);

      const getActDate = (c: any) => {
        if (c.activationDate) return c.activationDate;
        if (c.airtableData) {
          const ad = c.airtableData as any;
          const raw = ad['ALTA COMERCIALIZADORA'] || ad['FECHA INICIO'] || ad['Fecha firma contrato'];
          if (raw) return new Date(raw);
        }
        return null;
      };

      const getTermDate = (c: any) => {
        if (c.terminationDate) return c.terminationDate;
        if (c.airtableData) {
          const ad = c.airtableData as any;
          const raw = ad['BAJA COMERCIALIZADORA'] || ad['FECHA BAJA'];
          if (raw) return new Date(raw);
        }
        return null;
      };

      const overlappingContracts = allContracts.filter(c => {
        const validStatuses = ['ACTIVO', 'EN_VIGOR', 'Activo', 'FINALIZADO', 'Finalizado'];
        if (!validStatuses.includes(c.status)) return false;
        
        let actDate = getActDate(c);
        let termDate = getTermDate(c);

        if (!actDate) return false;
        
        const fileFechaFin = f1.fechaFin || new Date();
        const fileFechaInicio = f1.fechaInicio || new Date();
        
        const startOverlap = actDate <= fileFechaFin;
        const endOverlap = !termDate || termDate >= fileFechaInicio;
        
        return startOverlap && endOverlap;
      });

      overlappingContracts.sort((a, b) => {
        const aActive = (a.status === 'ACTIVO' || a.status === 'EN_VIGOR' || a.status === 'Activo') ? 1 : 0;
        const bActive = (b.status === 'ACTIVO' || b.status === 'EN_VIGOR' || b.status === 'Activo') ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const aDate = getActDate(a) || new Date(0);
        const bDate = getActDate(b) || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });

      const applicableContract = overlappingContracts[0];

      if (applicableContract) {
        newContractId = applicableContract.id;
      } else {
        // Fallback ACTIVO
        const activeFallback = allContracts.find(c => c.status === 'ACTIVO' || c.status === 'EN_VIGOR' || c.status === 'Activo');
        if (activeFallback) {
          newContractId = activeFallback.id;
        } else {
          const lastResort = allContracts.find(c => {
            const validStatuses = ['ACTIVO', 'EN_VIGOR', 'Activo', 'FINALIZADO', 'Finalizado'];
            return validStatuses.includes(c.status);
          });
          if (lastResort) newContractId = lastResort.id;
        }
      }

      // Check if it's Salvador's CUPS to print debug info
      if (sp.cups.startsWith('ES0031105447930001VY')) {
         console.log(`[DEBUG SALVADOR] F1: ${f1.fechaInicio?.toISOString().substring(0,10)} al ${f1.fechaFin?.toISOString().substring(0,10)}`);
         console.log(`[DEBUG SALVADOR] Current Contract ID: ${f1.contractId}`);
         console.log(`[DEBUG SALVADOR] New Assigned ID: ${newContractId}`);
         console.log(`[DEBUG SALVADOR] Overlapping Contracts Count: ${overlappingContracts.length}`);
         if (applicableContract) {
            console.log(`[DEBUG SALVADOR] Elegido por solapamiento: ${applicableContract.id} - ${applicableContract.status}`);
         } else {
            console.log(`[DEBUG SALVADOR] Elegido por Fallback Inteligente. Contrato ACTIVO encontrado.`);
         }
      }

      // If different, relink!
      if (newContractId && newContractId !== f1.contractId) {
        if (!sp.cups.startsWith('ES0031105447930001VY')) {
           console.log(`Revinculando F1 ${f1.numeroFactura} (CUPS: ${sp.cups}) de Contrato ${f1.contractId} a ${newContractId}`);
        }
        await prisma.f1Invoice.update({
          where: { id: f1.id },
          data: { contractId: newContractId }
        });
        
        // Also wipe internalInvoice so it goes back to Pendiente
        await prisma.internalInvoice.deleteMany({
          where: { f1InvoiceId: f1.id }
        });
        
        relinkedCount++;
      }
    }

    console.log(`¡Proceso completado! Se han re-vinculado ${relinkedCount} F1Invoices.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
