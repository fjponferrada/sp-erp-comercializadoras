import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const cups = 'ES0031101348002000000F';
  
  const supplyPoint = await prisma.supplyPoint.findFirst({
    where: { cups }
  });

  if (!supplyPoint) {
    console.log("No supply point found");
    return;
  }

  const contract = await prisma.contract.findFirst({
    where: { supplyPointId: supplyPoint.id },
    orderBy: { createdAt: 'desc' }
  });
  
  // Using findMany to avoid strict type checks on status
  const drafts = await prisma.internalInvoice.findMany({
    where: { supplyPointId: supplyPoint.id },
    orderBy: { createdAt: 'desc' }
  });
  const draft = drafts.find(d => d.status === 'BORRADOR');
  
  const f1s = await prisma.f1Invoice.findMany({
    where: { supplyPointId: supplyPoint.id },
    orderBy: { fechaEmision: 'desc' }
  });
  const f1 = f1s[0];
  
  console.log("CONTRACT PRICING MODEL:", contract?.pricingModel, "FEE:", contract?.fee, "P1E:", (contract as any)?.p1e);
  
  if (draft) {
    console.log("DRAFT RESULT TOTAL:", draft.totalAmount);
    console.log("DRAFT ENERGY DETAILS:", JSON.stringify((draft.invoiceData as any)?.periods || draft.invoiceData, null, 2));
  } else {
    console.log("NO DRAFT FOUND FOR CUPS:", cups);
  }
  
  if (f1) {
    const f1Data = (f1 as any).jsonData;
    if (f1Data) {
      console.log("F1 XML parsed data sample (facturacion total):", f1Data['ImporteTotalFactura'] || f1Data['TotalFactura'] || f1Data['Importe Total Factura']);
      
      const activeEnergy = f1Data.TerminoFacturacionEnergiaActiva || f1Data.TerminoEnergiaActiva || f1Data['Termino Facturacion Energia Activa'] || f1Data['Termino Energia Activa'];
      console.log("F1 Provider Active Energy:", JSON.stringify(activeEnergy, null, 2));
    } else {
       console.log("F1 has no jsonData");
    }
  } else {
    console.log("NO F1 FOUND FOR CUPS:", cups);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
