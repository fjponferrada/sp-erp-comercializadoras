import { config } from 'dotenv';
config({ path: '.env.production' });
config({ path: '.env', override: false });

import { prisma } from './src/lib/prisma';
import * as xlsx from 'xlsx';

async function main() {
  console.log('Querying database...');
  const supplyPoints = await prisma.supplyPoint.findMany({
    include: {
      contracts: {
        orderBy: { version: 'desc' },
        include: {
          client: true,
          user: {
            include: {
              channel: true
            }
          }
        }
      }
    }
  });

  const activePoints = [];
  const inactivePoints = [];

  for (const sp of supplyPoints) {
    if (sp.contracts.length === 0) continue;
    
    const activeContract = sp.contracts.find(c => c.status === 'ACTIVO');
    
    const referenceContract = activeContract || sp.contracts[0];
    const client = referenceContract.client;
    if (!client) continue;

    const nif = client.vatNumber ? client.vatNumber.replace(/[\s-]/g, '') : '';
    const nombre = client.businessName || (client.firstName ? `${client.firstName} ${client.lastName}` : '');
    const email = client.contactEmail || client.invoiceEmail || client.representativeEmail || '';
    const telefono = client.contactPhone || client.contactPhone2 || '';
    const canal = referenceContract.user?.channel?.name || '';

    const latestInvoice = await prisma.invoice.findFirst({
      where: { clientId: client.id, pdfUrl: { not: null } },
      orderBy: { issueDate: 'desc' }
    });

    const urlFactura = latestInvoice?.pdfUrl || '';

    const record = {
      NIF: nif,
      Nombre: nombre,
      CUPS: sp.cups,
      URL_Factura: urlFactura,
      Email: email,
      Telefono: telefono,
      Canal: canal
    };

    if (activeContract) {
      activePoints.push(record);
    } else {
      inactivePoints.push(record);
    }
  }

  console.log(`Found ${activePoints.length} active and ${inactivePoints.length} inactive supply points.`);

  // Active Excel
  const wbActive = xlsx.utils.book_new();
  const wsActive = xlsx.utils.json_to_sheet(activePoints);
  xlsx.utils.book_append_sheet(wbActive, wsActive, "Suministros Activos");
  xlsx.writeFile(wbActive, "C:/Users/Administrator/sp-erp-comercializadoras/docs/SuministrosActivos_CRM.xlsx");

  // Inactive Excel
  const wbInactive = xlsx.utils.book_new();
  const wsInactive = xlsx.utils.json_to_sheet(inactivePoints);
  xlsx.utils.book_append_sheet(wbInactive, wsInactive, "Suministros Inactivos");
  xlsx.writeFile(wbInactive, "C:/Users/Administrator/sp-erp-comercializadoras/docs/SuministrosInactivos_CRM.xlsx");

  console.log(`Successfully generated files.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
