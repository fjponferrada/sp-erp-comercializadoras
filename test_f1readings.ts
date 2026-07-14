import { prisma } from './src/lib/prisma';
function getArray(val: any) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

async function main() {
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: 'cmrhun2bg0008p8414ya0lcwg' }
  });
  if (!inv?.f1InvoiceId) return;
  const f1 = await prisma.f1Invoice.findUnique({
    where: { id: inv.f1InvoiceId }
  });
  
  const jsonData = typeof f1?.jsonData === 'string' ? JSON.parse(f1.jsonData) : f1?.jsonData;
  
  const f1Readings: any = {};
  for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
    f1Readings[p] = { actCons: 0, reactCons: 0, max: 0 };
  }

  const arrFacturasATR = getArray(jsonData?.Facturas?.FacturaATR);
  const medidas = jsonData?.Medidas || arrFacturasATR?.[0]?.Medidas;
  if (medidas) {
    const modelos = getArray(medidas.ModeloAparato);
    for (const mod of modelos) {
      const integradores = getArray(mod.Integrador);
      for (const intg of integradores) {
        const mag = intg.Magnitud;
        const cod = intg.CodigoPeriodo?.toString();
        
        let pName = '';
        if (cod && cod.length > 0) {
          const lastChar = cod.substring(cod.length - 1);
          if (['1','2','3','4','5','6'].includes(lastChar)) {
            pName = `P${lastChar}`;
          }
        }
        
        if (pName && f1Readings[pName]) {
          const consCalc = intg.ConsumoCalculado ?? intg.consumoCalculado;
          
          if (mag === 'AE' || mag === '1') {
             if (consCalc !== undefined) f1Readings[pName].actCons = parseFloat(consCalc.toString());
          } else if (mag === 'R1' || mag === '2') {
             if (consCalc !== undefined) f1Readings[pName].reactCons = parseFloat(consCalc.toString());
          }
        }
      }
    }
  }
  
  console.log("READINGS:");
  console.log(JSON.stringify(f1Readings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
