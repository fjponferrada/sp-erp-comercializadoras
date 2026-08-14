import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import path from 'path';

async function main() {
  console.log('Querying database for all supply points...');
  const supplyPoints = await prisma.supplyPoint.findMany({
    include: {
      contracts: {
        orderBy: { version: 'desc' },
        include: {
          client: true,
          user: {
            include: { channel: true }
          }
        }
      }
    }
  });

  const activePoints = [];
  const inactivePoints = [];

  for (const sp of supplyPoints) {
    if (sp.contracts.length === 0) continue;
    
    // Check status based on the newest contract for this supply point
    const newestContract = sp.contracts[0];
    const client = newestContract.client;
    if (!client) continue;

    let effectiveContract = newestContract;
    
    if (newestContract.status !== 'ACTIVO' && newestContract.status !== 'FINALIZADO') {
      const lowerActiveOrFinished = sp.contracts.find(c => c.status === 'ACTIVO' || c.status === 'FINALIZADO');
      if (lowerActiveOrFinished) {
        effectiveContract = lowerActiveOrFinished;
      }
    }

    const nif = client.vatNumber ? client.vatNumber.replace(/[\s-]/g, '') : '';
    const nombre = client.businessName || (client.firstName ? `${client.firstName} ${client.lastName}` : '');
    const email = client.contactEmail || client.invoiceEmail || client.representativeEmail || '';
    const telefono = client.contactPhone || client.contactPhone2 || '';
    const canal = effectiveContract.user?.channel?.name || effectiveContract.user?.name || '';
    
    let iban = sp.iban || effectiveContract.iban || '';
    if (!iban) {
      const spAirtable = sp.airtableData as any;
      if (spAirtable) {
        iban = spAirtable['IBAN'] || spAirtable['Iban'] || spAirtable['CUENTA BANCARIA'] || spAirtable['Cuenta Bancaria'] || spAirtable['Cuenta'] || '';
      }
      if (!iban) {
        const ctAirtable = effectiveContract.airtableData as any;
        if (ctAirtable) {
          iban = ctAirtable['IBAN'] || ctAirtable['Iban'] || ctAirtable['CUENTA BANCARIA'] || ctAirtable['Cuenta Bancaria'] || ctAirtable['Cuenta'] || '';
        }
      }
    }

    // Get latest invoice for this SPECIFIC SUPPLY POINT
    const latestInvoice = await prisma.invoice.findFirst({
      where: { supplyPointId: sp.id, pdfUrl: { not: null } },
      orderBy: { issueDate: 'desc' }
    });

    const urlFactura = latestInvoice?.pdfUrl || '';

    const row = {
      NIF: nif,
      Nombre: nombre,
      CUPS: sp.cups,
      IBAN: iban,
      URL_Factura: urlFactura,
      Email: email,
      Telefono: telefono,
      Canal: canal,
      Estado: effectiveContract.status
    };

    if (effectiveContract.status === 'ACTIVO') {
      activePoints.push(row);
    } else {
      inactivePoints.push(row);
    }
  }

  console.log(`Found ${activePoints.length} active and ${inactivePoints.length} inactive supply points.`);

  // Write Active
  const wbActive = xlsx.utils.book_new();
  const wsActive = xlsx.utils.json_to_sheet(activePoints);
  xlsx.utils.book_append_sheet(wbActive, wsActive, "Suministros Activos");
  const outActive = "C:/Users/Administrator/.gemini/antigravity/brain/c9a1ddfc-9914-43bc-94ae-b630d1db74de/SuministrosActivos_CRM.xlsx";
  xlsx.writeFile(wbActive, outActive);
  
  // Write Inactive
  const wbInactive = xlsx.utils.book_new();
  const wsInactive = xlsx.utils.json_to_sheet(inactivePoints);
  xlsx.utils.book_append_sheet(wbInactive, wsInactive, "Suministros Inactivos");
  const outInactive = "C:/Users/Administrator/.gemini/antigravity/brain/c9a1ddfc-9914-43bc-94ae-b630d1db74de/SuministrosInactivos_CRM.xlsx";
  xlsx.writeFile(wbInactive, outInactive);

  console.log(`Successfully generated files.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
