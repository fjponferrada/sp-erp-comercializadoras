import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Buscando facturas tipo R para generar abonos (AR)...');
  
  const f1s = await prisma.f1Invoice.findMany({
    where: { jsonData: { not: Array.isArray([]) ? [] : {} } }
  });

  let rCount = 0;
  let arCreated = 0;

  for (const f1 of f1s) {
    const jsonData = f1.jsonData as any;
    if (!jsonData) continue;

    const datosGen = jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                  || jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura 
                  || jsonData?.DatosGeneralesFactura;

    if (!datosGen || !datosGen.TipoFactura) continue;
    
    const tipo = typeof datosGen.TipoFactura === 'string' ? datosGen.TipoFactura : (Array.isArray(datosGen.TipoFactura) ? datosGen.TipoFactura[0] : 'N');
    
    if (tipo === 'R') {
      rCount++;
      const codOriginal = datosGen.CodigoFacturaRectificadaAnulada;
      const codAbono = datosGen.CodigoFacturaAbono;

      if (!codOriginal || !codAbono) {
        console.log(`[!] R sin códigos originales o abono: ${f1.numeroFactura}`);
        continue;
      }

      const strCodAbono = String(codAbono);
      const strCodOriginal = String(codOriginal);

      const existingAbono = await prisma.f1Invoice.findFirst({
        where: { numeroFactura: strCodAbono }
      });

      if (existingAbono) {
        continue;
      }

      const originalF1 = await prisma.f1Invoice.findFirst({
        where: { numeroFactura: strCodOriginal }
      });

      if (!originalF1 || !originalF1.jsonData) {
        console.log(`[!] Original no encontrada para ${strCodOriginal} (R: ${f1.numeroFactura})`);
        continue;
      }

      console.log(`[+] Generando AR para ${strCodAbono} a partir de ${strCodOriginal}`);
      
      const clonedJson = JSON.parse(JSON.stringify(originalF1.jsonData));
      
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
          tipoDocumento: originalF1.tipoDocumento,
          fechaEmision: originalF1.fechaEmision,
          fechaInicio: originalF1.fechaInicio,
          fechaFin: originalF1.fechaFin,
          saldoFactura: invSaldo,
          baseImponible: invBase,
          totalPeajes: invPeajes,
          totalCargos: invCargos,
          xmlUrl: f1.xmlUrl, 
          jsonData: clonedJson,
          supplyPointId: originalF1.supplyPointId,
          contractId: originalF1.contractId,
          facturaRealizada: true,
        }
      });
      arCreated++;
    }
  }

  console.log(`\n--- PROCESO COMPLETADO ---`);
  console.log(`Facturas R totales encontradas en BD: ${rCount}`);
  console.log(`Nuevos Abonos (AR) generados e inyectados: ${arCreated}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
