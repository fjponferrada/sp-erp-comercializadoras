import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const f1s = await prisma.f1Invoice.findMany({
      orderBy: { fechaInicio: 'asc' }
    });

    let created = 0;

    for (const f1 of f1s) {
      const dGen = (f1.jsonData as any)?.DatosGeneralesFacturaATR?.DatosGeneralesFactura || (f1.jsonData as any)?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura || (f1.jsonData as any)?.DatosGeneralesFactura;
      const tipoFacturaRaw = dGen?.TipoFactura;
      const parsedTipo = typeof tipoFacturaRaw === 'string' ? tipoFacturaRaw : (Array.isArray(tipoFacturaRaw) ? tipoFacturaRaw[0] : 'N');
      
      if (parsedTipo === 'R') {
        const codOriginal = dGen?.CodigoFacturaRectificadaAnulada;
        const codAbono = dGen?.CodigoFacturaAbono || (codOriginal ? `AR-${codOriginal}` : undefined);
        
        if (codOriginal && codAbono) {
          const strCodAbono = String(codAbono);
          const strCodOriginal = String(codOriginal);
          
          const existingAbono = await prisma.f1Invoice.findFirst({
            where: { numeroFactura: strCodAbono }
          });
          
          if (!existingAbono) {
            const originalF1 = await prisma.f1Invoice.findFirst({
              where: { numeroFactura: strCodOriginal }
            });
            
            if (originalF1 && originalF1.jsonData) {
              const sourceJson = originalF1.jsonData as any;
              const clonedJson = JSON.parse(JSON.stringify(sourceJson));
              
              const invertNumerics = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                for (const key in obj) {
                  if (typeof obj[key] === 'object') {
                    invertNumerics(obj[key]);
                  } else if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
                    const numKeys = ['ConsumoCalculado', 'consumoCalculado', 'ValorEnergiaActiva', 'valorEnergiaActiva', 'ValorEnergiaReactiva', 'valorEnergiaReactiva', 'ValorEnergiaExcedentaria', 'valorEnergiaExcedentaria', 'Importe', 'importe', 'ImporteTotalFactura', 'SaldoFactura', 'BaseImponibleF1', 'ImporteTotalPeajes', 'ImporteTotalCargos', 'ImporteAlquiler', 'ImpuestoElectrico', 'ImporteExcesosPotencia', 'ImportePenalizacionReactiva'];
                    const strVal = String(obj[key]);
                    if (numKeys.some(k => key.includes(k) || key === k)) {
                      const parsed = parseFloat(strVal.replace(',', '.'));
                      if (!isNaN(parsed)) {
                        obj[key] = (-parsed).toString().replace('.', ',');
                      }
                    }
                  }
                }
              };
              
              invertNumerics(clonedJson);

              if (clonedJson.DatosGeneralesFacturaATR?.DatosGeneralesFactura) {
                clonedJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.TipoFactura = 'AR';
                clonedJson.DatosGeneralesFacturaATR.DatosGeneralesFactura.CodigoFiscalFactura = strCodAbono;
              } else if (clonedJson.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura) {
                clonedJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.TipoFactura = 'AR';
                clonedJson.DatosGeneralesOtrasFacturas.DatosGeneralesFactura.CodigoFiscalFactura = strCodAbono;
              }
              
              const invSaldo = -(originalF1.saldoFactura || 0);
              const invBase = -(originalF1.baseImponible || 0);
              const invPeajes = -(originalF1.totalPeajes || 0);
              const invCargos = -(originalF1.totalCargos || 0);
              
              await prisma.f1Invoice.create({
                data: {
                  numeroFactura: strCodAbono,
                  tipoDocumento: originalF1.tipoDocumento || 'FacturaATR',
                  fechaEmision: new Date(),
                  fechaInicio: originalF1.fechaInicio,
                  fechaFin: originalF1.fechaFin,
                  saldoFactura: invSaldo,
                  baseImponible: invBase,
                  totalPeajes: invPeajes,
                  totalCargos: invCargos,
                  xmlUrl: originalF1.xmlUrl,
                  jsonData: clonedJson,
                  supplyPointId: originalF1.supplyPointId,
                  contractId: originalF1.contractId,
                  facturaRealizada: true,
                }
              });
              created++;
            }
          }
        }
      }
    }
    return NextResponse.json({ message: `Revisión completada. Se generaron ${created} abonos (AR) omitidos.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
