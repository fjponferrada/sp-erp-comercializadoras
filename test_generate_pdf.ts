import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const { InternalBillingEngine } = await import('./src/lib/services/InternalBillingEngine');
  const { InvoicePdfTemplate } = await import('./src/components/pdf/InvoicePdfTemplate');
  const f1s = await prisma.f1Invoice.findMany({
    where: { contractId: { not: null }, supplyPointId: { not: null } },
    take: 1,
    include: { 
      contract: { include: { supplyPoint: true, client: true } }, 
      invoices: true 
    }
  });

  if (f1s.length === 0) return;
  const f1 = f1s[0];

  const result = await InternalBillingEngine.calculate(f1.id);
  
  const templateData = {
    invoiceNumber: 'INT-26-0001',
    issueDate: new Date(),
    clientName: f1.contract?.client?.businessName || 'Desconocido',
    clientNif: f1.contract?.client?.vatNumber || 'S/N',
    clientAddress: f1.contract?.client?.billingAddress || '',
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

  const element = React.createElement(InvoicePdfTemplate, { data: templateData }) as any;
  const pdfStream = await renderToStream(element);
  const pdfChunks: any[] = [];
  for await (const chunk of pdfStream) {
    pdfChunks.push(chunk);
  }
  const pdfBuffer = Buffer.concat(pdfChunks);
  
  const outPath = path.join(process.cwd(), 'test_invoice.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log("PDF generado en:", outPath);
}

main().catch(console.error).finally(() => prisma.$disconnect());
