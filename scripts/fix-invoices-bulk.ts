import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Iniciando escaneo de corrección masiva de facturas...");

  // Determinar si es modo "dry-run" (por defecto sí, a menos que se pase el flag --apply)
  const isDryRun = !process.argv.includes('--apply');

  if (isDryRun) {
    console.log("⚠️ MODO DRY-RUN ACTIVADO. No se aplicarán cambios en la base de datos.");
    console.log("   Para aplicar los cambios, ejecuta el script con el flag '--apply'.\n");
  } else {
    console.log("⚠️ MODO APPLY ACTIVADO. Se actualizará la base de datos...\n");
  }

  try {
    // 1. Obtener todas las facturas que tengan un punto de suministro asignado
    const invoices = await prisma.invoice.findMany({
      where: {
        supplyPointId: { not: null },
        billingStart: { not: null }
      },
      select: {
        id: true,
        invoiceNumber: true,
        billingStart: true,
        billingEnd: true,
        clientId: true,
        contractId: true,
        supplyPointId: true,
        client: { select: { businessName: true } }
      }
    });

    console.log(`Se han encontrado ${invoices.length} facturas candidatas para revisión.`);

    // Agrupar facturas por SupplyPointId para optimizar las consultas de contratos
    const invoicesBySupplyPoint = invoices.reduce((acc, inv) => {
      if (!acc[inv.supplyPointId!]) acc[inv.supplyPointId!] = [];
      acc[inv.supplyPointId!].push(inv);
      return acc;
    }, {} as Record<string, typeof invoices>);

    const supplyPointIds = Object.keys(invoicesBySupplyPoint);
    
    let totalIssuesFound = 0;
    let totalFixed = 0;

    for (const spId of supplyPointIds) {
      // Obtener todos los contratos históricos de este punto de suministro
      const contracts = await prisma.contract.findMany({
        where: { supplyPointId: spId },
        orderBy: { activationDate: 'desc' },
        include: { client: { select: { businessName: true } } }
      });

      // Si no hay contratos, no podemos hacer mucho
      if (contracts.length === 0) continue;

      const spInvoices = invoicesBySupplyPoint[spId];

      for (const inv of spInvoices) {
        if (!inv.billingStart) continue; // No debería pasar por la query, pero por seguridad

        let correctContract = null;

        // Buscar el contrato que estuviera vigente durante el billingStart
        for (const contract of contracts) {
          const actDate = contract.activationDate || contract.signatureDate;
          const termDate = contract.terminationDate;
          
          if (actDate && inv.billingStart < actDate) continue; 
          if (termDate && inv.billingStart > termDate) continue;
          
          correctContract = contract;
          break;
        }

        // Si no se encontró un encaje exacto pero solo hay UN contrato para este CUPS, lo asumimos
        if (!correctContract && contracts.length === 1) {
          correctContract = contracts[0];
        }

        // Si encontramos un contrato aplicable y es distinto al actual
        if (correctContract) {
          if (inv.clientId !== correctContract.clientId || inv.contractId !== correctContract.id) {
            totalIssuesFound++;
            console.log(`[DESCUADRE ENCONTRADO] Factura: ${inv.invoiceNumber} | Fecha: ${inv.billingStart.toISOString().split('T')[0]}`);
            console.log(`   - ASIGNACIÓN ACTUAL : Cliente = ${inv.client?.businessName || inv.clientId} | Contrato = ${inv.contractId}`);
            console.log(`   - ASIGNACIÓN CORRECTA: Cliente = ${correctContract.client?.businessName || correctContract.clientId} | Contrato = ${correctContract.id}`);

            if (!isDryRun) {
              await prisma.invoice.update({
                where: { id: inv.id },
                data: {
                  clientId: correctContract.clientId,
                  contractId: correctContract.id
                }
              });
              console.log(`   ✅ CORREGIDO EN BASE DE DATOS`);
              totalFixed++;
            } else {
              console.log(`   ⏳ (SIMULADO) Se reasignaría a: ${correctContract.client?.businessName}`);
            }
            console.log("------------------------------------------------------------------");
          }
        }
      }
    }

    console.log(`\nRESUMEN:`);
    console.log(`- Facturas con asignación incorrecta detectadas: ${totalIssuesFound}`);
    if (!isDryRun) {
      console.log(`- Facturas corregidas exitosamente en BD: ${totalFixed}`);
    } else {
      console.log(`- Ninguna factura fue modificada (DRY-RUN)`);
    }

  } catch (e) {
    console.error("Error durante la ejecución del script:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
