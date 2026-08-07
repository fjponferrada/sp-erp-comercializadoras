import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import { config } from 'dotenv';
config({ path: '.env.production' });
config({ path: '.env', override: false });

const prisma = new PrismaClient();

async function main() {
  console.log('Querying database for INACTIVE supply points...');
  const supplyPoints = await prisma.supplyPoint.findMany({
    include: {
      contracts: {
        orderBy: { version: 'desc' },
        include: {
          client: true,
        }
      }
    }
  });

  const inactivePoints = [];

  for (const sp of supplyPoints) {
    if (sp.contracts.length === 0) continue;
    
    // Check for an ACTIVO contract
    const activeContract = sp.contracts.find(c => c.status === 'ACTIVO');
    
    // If it HAS an ACTIVO contract, it is an active supply point, so we skip it.
    // If it DOES NOT have an ACTIVO contract, it's considered INACTIVE.
    if (activeContract) continue;

    // Use the most recent contract to get the client details
    const referenceContract = sp.contracts[0];
    const client = referenceContract.client;
    if (!client) continue;

    const nif = client.vatNumber ? client.vatNumber.replace(/[\s-]/g, '') : '';
    const nombre = client.businessName || (client.firstName ? `${client.firstName} ${client.lastName}` : '');
    const email = client.contactEmail || client.invoiceEmail || client.representativeEmail || '';
    const telefono = client.contactPhone || client.contactPhone2 || '';

    // Get latest invoice for this client
    const latestInvoice = await prisma.invoice.findFirst({
      where: { clientId: client.id, pdfUrl: { not: null } },
      orderBy: { issueDate: 'desc' }
    });

    const urlFactura = latestInvoice?.pdfUrl || '';

    inactivePoints.push({
      NIF: nif,
      Nombre: nombre,
      CUPS: sp.cups,
      URL_Factura: urlFactura,
      Email: email,
      Telefono: telefono
    });
  }

  console.log(`Found ${inactivePoints.length} inactive supply points. Generating Excel...`);

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(inactivePoints);
  xlsx.utils.book_append_sheet(wb, ws, "Suministros Inactivos");

  const outputPath = "C:/Users/Administrator/sp-erp-comercializadoras/docs/SuministrosInactivos_CRM.xlsx";
  xlsx.writeFile(wb, outputPath);
  
  console.log(`Successfully generated file at: ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
