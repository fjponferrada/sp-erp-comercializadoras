import { config } from 'dotenv';
config({ path: '.env.production' });
config({ path: '.env', override: false });

import { prisma } from './src/lib/prisma';
import * as xlsx from 'xlsx';

async function main() {
  console.log('Querying supply points...');
  const supplyPoints = await prisma.supplyPoint.findMany();
  
  console.log('Querying contracts...');
  const allContracts = await prisma.contract.findMany({
    include: {
      client: true,
      user: {
        include: {
          channel: true
        }
      }
    },
    orderBy: { version: 'desc' }
  });

  // Group contracts by supplyPointId
  const spContractsMap = new Map();
  for (const c of allContracts) {
    if (!spContractsMap.has(c.supplyPointId)) {
      spContractsMap.set(c.supplyPointId, []);
    }
    spContractsMap.get(c.supplyPointId).push(c);
  }

  const activePoints = [];
  const inactivePoints = [];
  const clientsToFetchInvoicesFor = new Set();

  for (const sp of supplyPoints) {
    const contracts = spContractsMap.get(sp.id) || [];
    if (contracts.length === 0) continue;
    
    const activeContract = contracts.find((c: any) => c.status === 'ACTIVO');
    const referenceContract = activeContract || contracts[0];
    const client = referenceContract.client;
    if (!client) continue;

    const nif = client.vatNumber ? client.vatNumber.replace(/[\s-]/g, '') : '';
    const nombre = client.businessName || (client.firstName ? `${client.firstName} ${client.lastName}` : '');
    const email = client.contactEmail || client.invoiceEmail || client.representativeEmail || '';
    const telefono = client.contactPhone || client.contactPhone2 || '';
    const canal = referenceContract.user?.channel?.name || '';

    const record = {
      clientId: client.id, // temp field
      NIF: nif,
      Nombre: nombre,
      CUPS: sp.cups,
      URL_Factura: '',
      Email: email,
      Telefono: telefono,
      Canal: canal
    };

    clientsToFetchInvoicesFor.add(client.id);

    if (activeContract) {
      activePoints.push(record);
    } else {
      inactivePoints.push(record);
    }
  }

  console.log(`Fetching latest invoices for ${clientsToFetchInvoicesFor.size} unique clients...`);
  
  // To avoid hitting query limits, we'll fetch invoices in chunks of 500 clients
  const clientIdsArr = Array.from(clientsToFetchInvoicesFor) as string[];
  const chunkSize = 500;
  const latestInvoicesMap = new Map();

  for (let i = 0; i < clientIdsArr.length; i += chunkSize) {
    const chunk = clientIdsArr.slice(i, i + chunkSize);
    
    // Get ALL invoices for these clients that have a pdfUrl
    const invoices = await prisma.invoice.findMany({
      where: {
        clientId: { in: chunk },
        pdfUrl: { not: null }
      },
      select: { clientId: true, pdfUrl: true, issueDate: true },
      orderBy: { issueDate: 'desc' }
    });

    // Populate map with the first (most recent) one we find for each client
    for (const inv of invoices) {
      if (!latestInvoicesMap.has(inv.clientId)) {
        latestInvoicesMap.set(inv.clientId, inv.pdfUrl);
      }
    }
  }

  // Assign URLs and remove temp clientId
  for (const p of activePoints) {
    p.URL_Factura = latestInvoicesMap.get(p.clientId) || '';
    delete (p as any).clientId;
  }
  for (const p of inactivePoints) {
    p.URL_Factura = latestInvoicesMap.get(p.clientId) || '';
    delete (p as any).clientId;
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
