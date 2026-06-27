import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import { prisma } from './src/lib/prisma';

async function test() {
  try {
    const xmlString = fs.readFileSync('./scratch/test_f1.xml', 'utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: true,
    });
    const jsonObj = parser.parse(xmlString);

    const mensaje = jsonObj.MensajeFacturacion;
    if (!mensaje) {
      console.log('Error: No MensajeFacturacion');
      return;
    }

    const facturasList = mensaje.Facturas?.FacturaATR;
    const facturasAtrArray = facturasList ? (Array.isArray(facturasList) ? facturasList : [facturasList]) : [];
    
    const otrasFacturasList = mensaje.Facturas?.OtrasFacturas;
    const otrasFacturasArray = otrasFacturasList ? (Array.isArray(otrasFacturasList) ? otrasFacturasList : [otrasFacturasList]) : [];

    console.log(`facturasAtrArray.length = ${facturasAtrArray.length}`);
    console.log(`otrasFacturasArray.length = ${otrasFacturasArray.length}`);

    if (facturasAtrArray.length === 0 && otrasFacturasArray.length === 0) {
       console.log('Error: no contiene ninguna FacturaATR');
       return;
    }

    for (const f of facturasAtrArray) {
      const dGen = f.DatosGeneralesFacturaATR || {};
      let cups = dGen.DireccionSuministro?.CUPS || f.Medidas?.CodPM || f.CodPM || mensaje.Cabecera?.CUPS;
      if (cups) cups = String(cups).trim();
      
      const codFactura = dGen.DatosGeneralesFactura?.CodigoFiscalFactura;
      const parsedCodFactura = codFactura ? String(codFactura) : 'SIN_COD';
      console.log(`Factura: CUPS=${cups}, Codigo=${parsedCodFactura}`);
      
      const fechaEmiStr = dGen.DatosGeneralesFactura?.FechaFactura;
      const rawSaldo = dGen.DatosGeneralesFactura?.SaldoFactura;
      const rawImporteTotal = dGen.DatosGeneralesFactura?.ImporteTotalFactura;
      const saldo = parseFloat(rawSaldo !== undefined ? rawSaldo : (rawImporteTotal !== undefined ? rawImporteTotal : '0'));
      
      const dFact = dGen.DatosFacturaATR || f.DatosFacturaATR || {};
      const fechaIniStr = dFact.Periodo?.FechaDesdeFactura || dFact.FechaInicioPeriodo;
      const fechaFinStr = dFact.Periodo?.FechaHastaFactura || dFact.FechaFinPeriodo;
      
      const rawTotalPeajes = dFact.ImportesFactura?.ImporteTotalPeajes;
      const totalPeajes = parseFloat(rawTotalPeajes !== undefined ? rawTotalPeajes : '0');
      
      const rawTotalCargos = dFact.ImportesFactura?.ImporteTotalCargos;
      const totalCargos = parseFloat(rawTotalCargos !== undefined ? rawTotalCargos : '0');
      
      const rawBase = dGen.DatosGeneralesFactura?.BaseImponibleF1;
      const baseImp = parseFloat(rawBase !== undefined ? rawBase : '0');
      
      let supplyPointId = undefined;
      let contractId = undefined;

      try {
        const newF1 = await prisma.f1Invoice.create({
          data: {
            numeroFactura: parsedCodFactura,
            tipoDocumento: 'FacturaATR',
            fechaEmision: fechaEmiStr ? new Date(fechaEmiStr) : undefined,
            fechaInicio: fechaIniStr ? new Date(fechaIniStr) : undefined,
            fechaFin: fechaFinStr ? new Date(fechaFinStr) : undefined,
            saldoFactura: isNaN(saldo) ? 0 : saldo,
            baseImponible: isNaN(baseImp) ? 0 : baseImp,
            totalPeajes: isNaN(totalPeajes) ? 0 : totalPeajes,
            totalCargos: isNaN(totalCargos) ? 0 : totalCargos,
            xmlUrl: 'test_url',
            jsonData: f,
            supplyPointId,
            contractId,
            facturaRealizada: true,
          }
        });
        console.log(`Inserted F1 ID: ${newF1.id}`);
        
        if (parsedCodFactura !== 'SIN_COD') {
          await prisma.$executeRaw`
            UPDATE "Invoice"
            SET "f1InvoiceId" = ${newF1.id}
            WHERE "f1InvoiceId" IS NULL AND (
              LTRIM(TRIM(REPLACE(REPLACE("invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = LTRIM(${parsedCodFactura}, '0')
              OR LTRIM("invoiceData"->>'Numero Factura .xml', '0') = LTRIM(CONCAT(${parsedCodFactura}, '.xml'), '0')
              OR LTRIM("invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', LTRIM(${parsedCodFactura}, '0'))
            )
          `;
          console.log('Executed raw SQL successfully');
        }
        
        // Limpiar para poder volver a probar
        await prisma.f1Invoice.delete({ where: { id: newF1.id } });
      } catch (err: any) {
        console.error(`Error de Prisma al crear la factura: ${err.message}`);
      }
    }

  } catch (err: any) {
    console.error('Exception:', err.message);
  }
}

test();
