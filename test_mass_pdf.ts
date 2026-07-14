import { PrismaClient } from '@prisma/client';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { InvoicePdfTemplate } from './src/components/pdf/InvoicePdfTemplate';
import { generateInvoiceXml } from './src/lib/templates/invoiceXmlTemplate';
import fs from 'fs';
import path from 'path';

async function main() {
  const { prisma } = await import('./src/lib/prisma');
  
  const f1s = await prisma.f1Invoice.findMany({
    where: { contractId: { not: null }, supplyPointId: { not: null } },
    take: 3,
    include: { contract: { include: { supplyPoint: true, client: true } }, invoices: true }
  });

  console.log(`Testeando generación masiva para ${f1s.length} facturas...\n`);

  for (let i = 0; i < f1s.length; i++) {
    const f1 = f1s[i];
    try {
      const result = await InternalBillingEngine.calculate(f1.id);
      const clientName = f1.contract?.client?.businessName || 'Desconocido';
      const clientNif = f1.contract?.client?.vatNumber || 'S/N';
      const clientAddress = f1.contract?.client?.billingAddress || '';

      const templateData = {
        invoiceNumber: `INT-26-000${i+1}`,
        issueDate: new Date(),
        clientName,
        clientNif,
        clientAddress,
        cups: f1.contract?.supplyPoint?.cups || 'S/N',
        tariff: f1.contract?.supplyPoint?.tariff || '',
        contractedPower: f1.contract?.p1p || '',
        billingStart: f1.fechaInicio,
        billingEnd: f1.fechaFin,
        totalMWh: result.totalF1MWh,
        subtotal1: result.totalBase,
        taxPercentage: 21,
        taxAmount: result.taxAmount,
        totalAmount: result.totalAmount,
        powerDetails: result.powerDetails || [],
        energyAtrDetails: result.energyAtrDetails || [],
        energyMarketDetails: result.energyMarketDetails || [],
        alquilerEquipo: result.alquilerEquipo || 0,
        bonoSocial: result.bonoSocial || 0,
        taxElectric: result.taxElectric || 0
      };

      // TEST PDF
      const element = React.createElement(InvoicePdfTemplate, { data: templateData }) as any;
      const pdfStream = await renderToStream(element);
      const pdfChunks: any[] = [];
      for await (const chunk of pdfStream) {
        pdfChunks.push(chunk);
      }
      const pdfBuffer = Buffer.concat(pdfChunks);
      const pdfPath = path.join(process.cwd(), `test_invoice_${i}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      // TEST XML
      const xmlStr = generateInvoiceXml(templateData);
      const xmlPath = path.join(process.cwd(), `test_invoice_${i}.xml`);
      fs.writeFileSync(xmlPath, xmlStr);

      console.log(`[OK] Factura ${i} -> Generado PDF de ${(pdfBuffer.length / 1024).toFixed(1)} KB y XML de ${(xmlStr.length / 1024).toFixed(1)} KB`);
    } catch (e: any) {
      console.log(`[FAIL] Factura ${i} -> Error: ${e.message}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
