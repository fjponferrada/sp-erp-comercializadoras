'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { XMLParser } from 'fast-xml-parser';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function ingestF1XmlAction(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No se envió ningún archivo' };
    }

    const originalName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const xmlString = buffer.toString('utf-8');

    // 1. Parsear el XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: true,
    });
    const jsonObj = parser.parse(xmlString);

    const mensaje = jsonObj.MensajeFacturacion;
    if (!mensaje) {
      return { success: false, error: `El archivo ${originalName} no tiene la estructura XML esperada (<MensajeFacturacion>).` };
    }

    const proceso = mensaje.Cabecera?.CodigoDeProceso;
    if (proceso && !proceso.startsWith('F1')) {
      return { success: false, error: `El archivo ${originalName} es del proceso ${proceso}, no F1.` };
    }

    // El XML puede traer múltiples facturas, o solo una. Si no es array, lo forzamos a array.
    const facturasList = mensaje.Facturas?.FacturaATR || [];
    const facturasAtrArray = Array.isArray(facturasList) ? facturasList : [facturasList];

    if (facturasAtrArray.length === 0) {
       return { success: false, error: `El archivo ${originalName} no contiene ninguna FacturaATR.` };
    }

    // 2. Subir a Cloudflare R2
    const standardizedName = `${originalName.replace('.xml', '')}_${Date.now()}.xml`;
    const r2Key = `switching/recibidos/F1/${standardizedName}`;

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'aed-energia',
      Key: r2Key,
      Body: buffer,
      ContentType: 'application/xml',
    }));
    
    const xmlUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

    // 3. Procesar e insertar en Prisma cada factura
    let procesadas = 0;
    for (const f of facturasAtrArray) {
      const dGen = f.DatosGeneralesFacturaATR || {};
      const cups = dGen.DireccionSuministro?.CUPS;
      const codFactura = dGen.DatosGeneralesFactura?.CodigoFiscalFactura;
      const fechaEmiStr = dGen.DatosGeneralesFactura?.FechaFactura;
      
      const rawSaldo = dGen.DatosGeneralesFactura?.SaldoFactura;
      const rawImporteTotal = dGen.DatosGeneralesFactura?.ImporteTotalFactura;
      const saldo = parseFloat(rawSaldo !== undefined ? rawSaldo : (rawImporteTotal !== undefined ? rawImporteTotal : '0'));
      
      const dFact = f.DatosFacturaATR || {};
      const fechaIniStr = dFact.FechaInicioPeriodo;
      const fechaFinStr = dFact.FechaFinPeriodo;
      
      const rawTotalPeajes = dFact.ImportesFactura?.ImporteTotalPeajes;
      const totalPeajes = parseFloat(rawTotalPeajes !== undefined ? rawTotalPeajes : '0');
      
      const rawTotalCargos = dFact.ImportesFactura?.ImporteTotalCargos;
      const totalCargos = parseFloat(rawTotalCargos !== undefined ? rawTotalCargos : '0');
      
      const rawBase = dGen.DatosGeneralesFactura?.BaseImponibleF1;
      const baseImp = parseFloat(rawBase !== undefined ? rawBase : '0');
      
      // Buscar CUPS en BD
      let supplyPointId = undefined;
      let contractId = undefined;

      if (cups) {
        const sp = await prisma.supplyPoint.findFirst({ where: { cups: cups }});
        if (sp) {
          supplyPointId = sp.id;
        }
      }

      await prisma.f1Invoice.create({
        data: {
          numeroFactura: codFactura || 'SIN_COD',
          fechaEmision: fechaEmiStr ? new Date(fechaEmiStr) : undefined,
          fechaInicio: fechaIniStr ? new Date(fechaIniStr) : undefined,
          fechaFin: fechaFinStr ? new Date(fechaFinStr) : undefined,
          saldoFactura: isNaN(saldo) ? 0 : saldo,
          baseImponible: isNaN(baseImp) ? 0 : baseImp,
          totalPeajes: isNaN(totalPeajes) ? 0 : totalPeajes,
          totalCargos: isNaN(totalCargos) ? 0 : totalCargos,
          xmlUrl: xmlUrl,
          jsonData: f,
          supplyPointId,
          facturaRealizada: true,
        }
      });
      procesadas++;
    }

    return { success: true, count: procesadas };

  } catch (error: any) {
    console.error('Error ingestF1XmlAction:', error);
    return { success: false, error: error.message };
  }
}
