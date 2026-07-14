import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--apply') ? false : true;

async function main() {
  console.log(`=== SCRIPT DE CORRECCIÓN MASIVA DE FACTURAS ===`);
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (Solo Lectura)' : 'APPLY (Actualizando BD)'}\n`);

  const invalidStatuses = ['RECHAZO_DISTRIBUIDORA', 'ANULADO'];
  const validStatuses = ['ACTIVO', 'BAJA', 'FINALIZADO'];

  // 1. Obtener todas las facturas de cliente con contratos inválidos o nulos
  console.log("-> Analizando Invoices (Cliente)...");
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { contract: { status: { in: invalidStatuses } } },
        { contractId: null }
      ]
    },
    include: {
      supplyPoint: true,
      contract: true
    }
  });

  let invoicesMoved = 0;

  for (const inv of invoices) {
    // Intentar obtener el CUPS de la factura
    let cups = inv.supplyPoint?.cups;
    if (!cups && inv.invoiceData) {
      const data = inv.invoiceData as any;
      cups = data['CUPS'] || data['cups'];
    }

    if (!cups) continue;

    // Buscar contratos válidos para este CUPS
    const validContracts = await prisma.contract.findMany({
      where: {
        supplyPoint: { cups: cups },
        status: { in: validStatuses }
      },
      include: {
        supplyPoint: true
      },
      orderBy: { activationDate: 'desc' }
    });

    if (validContracts.length === 0) continue;

    // Encontrar el mejor contrato (el que cubre el periodo de la factura)
    let bestContract = validContracts[0];
    if (inv.billingStart && inv.billingEnd) {
      for (const vc of validContracts) {
        if (!vc.activationDate) continue;
        const activation = vc.activationDate.getTime();
        const termination = (vc.terminationDate || vc.expectedEndDate)?.getTime() || Infinity;
        const invEnd = inv.billingEnd.getTime();
        const invStart = inv.billingStart.getTime();

        // Check if invoice overlaps with contract
        if (activation <= invEnd && termination >= invStart) {
          bestContract = vc;
          break; // Found an overlapping one
        }
      }
    }

    // Comprobar si hay que mover
    if (inv.contractId !== bestContract.id || inv.supplyPointId !== bestContract.supplyPointId || inv.clientId !== bestContract.supplyPoint.clientId) {
      console.log(`[Invoice] ${inv.invoiceNumber} (CUPS: ${cups}) | Actual: ${inv.contract?.status || 'Null'} -> Nuevo: ${bestContract.status} (ID: ${bestContract.id})`);
      
      if (!DRY_RUN) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            contractId: bestContract.id,
            supplyPointId: bestContract.supplyPointId,
            clientId: bestContract.supplyPoint.clientId
          }
        });
      }
      invoicesMoved++;
    }
  }

  // 2. Obtener todas las F1Invoices con contratos inválidos o nulos
  console.log("\n-> Analizando F1Invoices (Distribuidora)...");
  const f1Invoices = await prisma.f1Invoice.findMany({
    where: {
      OR: [
        { contract: { status: { in: invalidStatuses } } },
        { contractId: null }
      ]
    },
    include: {
      supplyPoint: true,
      contract: true
    }
  });

  let f1InvoicesMoved = 0;

  for (const inv of f1Invoices) {
    let cups = inv.supplyPoint?.cups;
    if (!cups) continue; // F1 Invoices generally have supplyPointId correctly, or we can't guess easily

    const validContracts = await prisma.contract.findMany({
      where: {
        supplyPoint: { cups: cups },
        status: { in: validStatuses }
      },
      include: {
        supplyPoint: true
      },
      orderBy: { activationDate: 'desc' }
    });

    if (validContracts.length === 0) continue;

    let bestContract = validContracts[0];
    if (inv.fechaInicio && inv.fechaFin) {
      for (const vc of validContracts) {
        if (!vc.activationDate) continue;
        const activation = vc.activationDate.getTime();
        const termination = (vc.terminationDate || vc.expectedEndDate)?.getTime() || Infinity;
        const invEnd = inv.fechaFin.getTime();
        const invStart = inv.fechaInicio.getTime();

        if (activation <= invEnd && termination >= invStart) {
          bestContract = vc;
          break;
        }
      }
    }

    if (inv.contractId !== bestContract.id || inv.supplyPointId !== bestContract.supplyPointId) {
      console.log(`[F1Invoice] ${inv.invoiceNumber} (CUPS: ${cups}) | Actual: ${inv.contract?.status || 'Null'} -> Nuevo: ${bestContract.status} (ID: ${bestContract.id})`);
      
      if (!DRY_RUN) {
        await prisma.f1Invoice.update({
          where: { id: inv.id },
          data: {
            contractId: bestContract.id,
            supplyPointId: bestContract.supplyPointId
          }
        });
      }
      f1InvoicesMoved++;
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Invoices (Cliente) afectadas: ${invoicesMoved}`);
  console.log(`F1Invoices (Distribuidora) afectadas: ${f1InvoicesMoved}`);
  if (DRY_RUN) {
    console.log(`NOTA: Para aplicar los cambios, ejecuta el script con el argumento --apply`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
