import { prisma } from './src/lib/prisma';
import * as fs from 'fs';

async function main() {
  const inv = await prisma.internalInvoice.findFirst({
    where: {
      contract: {
        supplyPoint: { cups: { contains: 'ES0031104899528001TR' } }
      }
    },
    orderBy: { issueDate: 'desc' }
  });

  if (!inv || !inv.invoiceData) {
    console.log("No invoice data found.");
    return;
  }

  const invoiceData = inv.invoiceData as any;
  const hourlyDetails = invoiceData.hourlyDetails;
  
  if (!hourlyDetails) {
    console.log("No hourly details found in JSON.");
    return;
  }

  // Pick 5 random hours
  // Let's pick 5 specific hours instead of random so we can see them clearly.
  // indices: 0, 100, 200, 300, 400
  const indices = [0, 50, 150, 300, 400];
  
  console.log("COMPARATIVA DE 5 HORAS ENTRE MOTOR INTERNO Y PROVEEDOR");
  console.log("======================================================");

  indices.forEach(idx => {
    if (idx >= hourlyDetails.length) return;
    const h = hourlyDetails[idx];
    
    // In our engine: 
    // base = (omie + sumComps + pc + rom + ros + dsv) * lossFactor
    // ph = (base + fnee + fee) / 0.985
    const internalBaseBeforeLosses = h.omie + h.sumComps + h.pc + h.rom + h.ros + h.dsv;
    
    console.log(`Hora: ${h.date} (Período: ${h.period})`);
    console.log(`[Motor Interno]`);
    console.log(` - OMIE: ${h.omie.toFixed(2)}`);
    console.log(` - Componentes Regulados (sumComps + pc + rom + ros): ${(h.sumComps + h.pc + h.rom + h.ros).toFixed(2)}`);
    console.log(` - Desvíos: ${h.dsv.toFixed(2)}`);
    console.log(` - Base (antes perdidas): ${internalBaseBeforeLosses.toFixed(2)}`);
    console.log(` - Coste con pérdidas (mercado base): ${(internalBaseBeforeLosses * h.lossFactor).toFixed(2)} (Perdidas: ${h.lossFactor.toFixed(6)})`);
    console.log(` - Precio Final Pura Energía (Ph): ${h.ph.toFixed(2)}`);
    console.log(`------------------------------------------------------`);
  });

}

main().catch(console.error).finally(() => process.exit(0));
