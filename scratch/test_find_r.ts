import { prisma } from './src/lib/prisma'; 

async function test() { 
  const arCode = '171261S000514021';
  const allR = await prisma.f1Invoice.findMany({ 
    where: { 
      jsonData: { not: Array.isArray([]) ? [] : {} } 
    } 
  }); 

  for (const r of allR) {
    const dG = (r.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
            || (r.jsonData as any)?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
            || (r.jsonData as any)?.DatosGeneralesFactura;
    
    if (dG?.CodigoFacturaAbono === arCode) {
      console.log('Found R:', r.numeroFactura);
      console.log('Original N:', dG.CodigoFacturaRectificadaAnulada);
    }
  }
} 

test().catch(console.error).finally(()=>process.exit(0));
