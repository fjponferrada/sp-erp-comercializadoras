const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

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
  
  console.log("CONTRACT PRICING MODEL:", contract?.pricingModel);
  console.log("CONTRACT PRICES:", JSON.stringify({
      p1e: contract?.p1e, p2e: contract?.p2e, p3e: contract?.p3e, p4e: contract?.p4e, p5e: contract?.p5e, p6e: contract?.p6e,
      p1p: contract?.p1p, p2p: contract?.p2p, p3p: contract?.p3p, p4p: contract?.p4p, p5p: contract?.p5p, p6p: contract?.p6p
  }, null, 2));
  
  if (draft) {
    console.log("DRAFT RESULT TOTAL:", draft.totalAmount);
    console.log("DRAFT ENERGY DETAILS:", JSON.stringify((draft.invoiceData)?.periods || draft.invoiceData, null, 2));
  } else {
    console.log("NO DRAFT FOUND FOR CUPS:", cups);
  }
  
  if (f1) {
    const f1Data = f1.jsonData;
    if (f1Data) {
      const activeEnergy = f1Data.TerminoFacturacionEnergiaActiva || f1Data.TerminoEnergiaActiva || f1Data['Termino Facturacion Energia Activa'] || f1Data['Termino Energia Activa'];
      console.log("F1 Provider Active Energy block:", JSON.stringify(activeEnergy, null, 2));
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
