'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { XMLParser } from 'fast-xml-parser';
import AdmZip from 'adm-zip';
import { fromZonedTime } from 'date-fns-tz';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function ingestF1WorkerXml(file: File) {
  return await handleFileOrZip(file, ingestF1Core);
}

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

    return await handleFileOrZip(file, ingestF1Core);
  } catch (error: any) {
    console.error('Error ingestF1XmlAction:', error);
    return { success: false, error: error.message };
  }
}

async function handleFileOrZip(file: File, coreFn: (f: File) => Promise<any>) {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    let successCount = 0;
    const errors: string[] = [];
    
    for (const zipEntry of zipEntries) {
      if (!zipEntry.isDirectory && zipEntry.entryName.toLowerCase().endsWith('.xml')) {
        const xmlBuffer = zipEntry.getData();
        const fakeFile = {
          name: zipEntry.name,
          arrayBuffer: async () => xmlBuffer.buffer.slice(xmlBuffer.byteOffset, xmlBuffer.byteOffset + xmlBuffer.byteLength) as ArrayBuffer
        } as unknown as File;
        
        try {
          const res = await coreFn(fakeFile);
          if (res.success) {
            successCount += (res.count || 1);
          } else {
            errors.push(`${zipEntry.name}: ${res.error}`);
          }
        } catch (e: any) {
          errors.push(`${zipEntry.name}: ${e.message}`);
        }
      }
    }
    
    return { 
      success: errors.length === 0 || successCount > 0, 
      count: successCount,
      error: errors.length > 0 ? errors.join(' | ') : undefined
    };
  } else {
    return await coreFn(file);
  }
}

async function ingestF1Core(file: File) {
  try {
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

    const facturasList = mensaje.Facturas?.FacturaATR;
    const facturasAtrArray = facturasList ? (Array.isArray(facturasList) ? facturasList : [facturasList]) : [];
    
    const otrasFacturasList = mensaje.Facturas?.OtrasFacturas;
    const otrasFacturasArray = otrasFacturasList ? (Array.isArray(otrasFacturasList) ? otrasFacturasList : [otrasFacturasList]) : [];

    if (facturasAtrArray.length === 0 && otrasFacturasArray.length === 0) {
       return { success: false, error: `El archivo ${originalName} no contiene ninguna FacturaATR ni OtrasFacturas.` };
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
      let cups = dGen.DireccionSuministro?.CUPS || f.Medidas?.CodPM || f.CodPM || mensaje.Cabecera?.CUPS;
      if (cups) cups = String(cups).trim();

      const codFactura = dGen.DatosGeneralesFactura?.CodigoFiscalFactura;
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
      
      // Buscar CUPS en BD
      let supplyPointId = undefined;
      let contractId = undefined;

      if (cups) {
        const baseCups = cups.substring(0, 20);
        const sps = await prisma.supplyPoint.findMany({ 
          where: { cups: { startsWith: baseCups } },
          include: { contracts: { orderBy: { createdAt: 'desc' } } }
        });
        
        if (sps.length > 0) {
          // Flatten all contracts from all SupplyPoints that share this CUPS
          const allContracts = sps.flatMap(sp => sp.contracts);
          // Usa el ID del primer SP como referencia principal
          supplyPointId = sps[0].id;
          
          const getActDate = (c: any) => {
            if (c.activationDate) return c.activationDate;
            if (c.airtableData) {
              const ad = c.airtableData as any;
              const raw = ad['ALTA COMERCIALIZADORA'] || ad['FECHA INICIO'] || ad['Fecha firma contrato'];
              if (raw) return new Date(raw);
            }
            return null;
          };

          const getTermDate = (c: any) => {
            if (c.terminationDate) return c.terminationDate;
            if (c.airtableData) {
              const ad = c.airtableData as any;
              const raw = ad['BAJA COMERCIALIZADORA'] || ad['FECHA BAJA'];
              if (raw) return new Date(raw);
            }
            return null;
          };

          const overlappingContracts = allContracts.filter(c => {
            const validStatuses = ['ACTIVO', 'EN_VIGOR', 'Activo', 'FINALIZADO', 'Finalizado'];
            if (!validStatuses.includes(c.status)) return false;
            
            let actDate = getActDate(c);
            let termDate = getTermDate(c);

            if (!actDate) return false;
            
            const fileFechaFin = fechaFinStr ? new Date(fechaFinStr) : new Date();
            const fileFechaInicio = fechaIniStr ? new Date(fechaIniStr) : new Date();
            
            const startOverlap = actDate <= fileFechaFin;
            const endOverlap = !termDate || termDate >= fileFechaInicio;
            
            return startOverlap && endOverlap;
          });
          
          // En caso de solapamiento, priorizar el que esté activo. Si hay varios, el de activación más reciente.
          overlappingContracts.sort((a, b) => {
            const aActive = (a.status === 'ACTIVO' || a.status === 'EN_VIGOR' || a.status === 'Activo') ? 1 : 0;
            const bActive = (b.status === 'ACTIVO' || b.status === 'EN_VIGOR' || b.status === 'Activo') ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            
            const aDate = getActDate(a) || new Date(0);
            const bDate = getActDate(b) || new Date(0);
            return bDate.getTime() - aDate.getTime();
          });
          const applicableContract = overlappingContracts[0];
          
          if (applicableContract) {
            contractId = applicableContract.id;
          } else {
            // Fallback: Buscar el contrato ACTIVO más reciente
            const activeFallback = allContracts.find(c => c.status === 'ACTIVO' || c.status === 'EN_VIGOR' || c.status === 'Activo');
            if (activeFallback) {
              contractId = activeFallback.id;
            } else {
              // Si no hay ninguno activo, coger el más reciente que no sea borrador
              const lastResort = allContracts.find(c => c.status !== 'DRAFT' && c.status !== 'Borrador');
              if (lastResort) contractId = lastResort.id;
            }
          }
        }
      }

      const parsedCodFactura = codFactura ? String(codFactura) : 'SIN_COD';
      const finalFechaEmi = fechaEmiStr ? new Date(fechaEmiStr) : undefined;
      const finalSaldo = isNaN(saldo) ? 0 : saldo;

      // Buscar si ya existe para obviar y no machacar datos ni la fecha de importación
      let existingF1;
      if (parsedCodFactura !== 'SIN_COD') {
        existingF1 = await prisma.f1Invoice.findFirst({
          where: { numeroFactura: parsedCodFactura }
        });
      } else if (supplyPointId && finalFechaEmi) {
        existingF1 = await prisma.f1Invoice.findFirst({
          where: { 
            numeroFactura: 'SIN_COD',
            supplyPointId,
            fechaEmision: finalFechaEmi,
            saldoFactura: finalSaldo
          }
        });
      }

      if (existingF1) {
        continue; // La obviamos
      }

      const parseAndShiftDate = (dStr: string, shiftDays: number = 0) => {
        if (!dStr) return undefined;
        // Parse YYYY-MM-DD into exact midnight in Madrid for the NEXT day
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          const d = parseInt(parts[2]) + shiftDays; // shift days forward
          
          // Use a UTC Date constructor just to handle month/year overflow natively
          const overflowDate = new Date(Date.UTC(y, m - 1, d));
          const dateStr = overflowDate.toISOString().substring(0, 10) + 'T00:00:00';
          
          // Use fromZonedTime to get the exact UTC moment of that local Madrid time
          return fromZonedTime(dateStr, 'Europe/Madrid');
        }
        return undefined;
      };

      const newF1 = await prisma.f1Invoice.create({
        data: {
          numeroFactura: parsedCodFactura,
          tipoDocumento: 'FacturaATR',
          fechaEmision: fechaEmiStr ? new Date(fechaEmiStr) : undefined,
          fechaInicio: parseAndShiftDate(fechaIniStr, 1),
          fechaFin: parseAndShiftDate(fechaFinStr, 1),
          saldoFactura: isNaN(saldo) ? 0 : saldo,
          baseImponible: isNaN(baseImp) ? 0 : baseImp,
          totalPeajes: isNaN(totalPeajes) ? 0 : totalPeajes,
          totalCargos: isNaN(totalCargos) ? 0 : totalCargos,
          xmlUrl: xmlUrl,
          jsonData: f,
          supplyPointId,
          contractId,
          facturaRealizada: true,
        }
      });

      // Intentar enlazar automáticamente con una factura ya importada
      if (parsedCodFactura !== 'SIN_COD') {
        if (supplyPointId) {
          await prisma.$executeRaw`
            UPDATE "Invoice"
            SET "f1InvoiceId" = ${newF1.id}
            WHERE "f1InvoiceId" IS NULL AND "supplyPointId" = ${supplyPointId} AND (
              LTRIM(TRIM(REPLACE(REPLACE("invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = LTRIM(${parsedCodFactura}::text, '0')
              OR LTRIM("invoiceData"->>'Numero Factura .xml', '0') = LTRIM(CONCAT(${parsedCodFactura}::text, '.xml'), '0')
              OR LTRIM("invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', LTRIM(${parsedCodFactura}::text, '0'))
              OR (
                DATE("billingStart") = DATE(${newF1.fechaInicio ? newF1.fechaInicio : null}::timestamp)
                AND DATE("billingEnd") = DATE(${newF1.fechaFin ? newF1.fechaFin : null}::timestamp)
                AND "billingStart" IS NOT NULL
                AND "rectifiedInvoiceId" IS NULL
              )
            )
          `;
        } else {
          await prisma.$executeRaw`
            UPDATE "Invoice"
            SET "f1InvoiceId" = ${newF1.id}
            WHERE "f1InvoiceId" IS NULL AND (
              LTRIM(TRIM(REPLACE(REPLACE("invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = LTRIM(${parsedCodFactura}::text, '0')
              OR LTRIM("invoiceData"->>'Numero Factura .xml', '0') = LTRIM(CONCAT(${parsedCodFactura}::text, '.xml'), '0')
              OR LTRIM("invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', LTRIM(${parsedCodFactura}::text, '0'))
            )
          `;
        }
      }

      procesadas++;
    }

    // Procesar OtrasFacturas
    for (const of of otrasFacturasArray) {
      const dGen = of.DatosGeneralesOtrasFacturas || {};
      let cups = mensaje.Cabecera?.CUPS; // El CUPS viene en la Cabecera para OtrasFacturas
      if (cups) cups = String(cups).trim();

      const codFactura = dGen.DatosGeneralesFactura?.CodigoFiscalFactura;
      const fechaEmiStr = dGen.DatosGeneralesFactura?.FechaFactura;
      const motivoFacturacion = dGen.DatosGeneralesFactura?.MotivoFacturacion;
      
      const rawImporteTotal = dGen.DatosGeneralesFactura?.ImporteTotalFactura;
      const saldo = parseFloat(rawImporteTotal !== undefined ? rawImporteTotal : '0');
      
      let supplyPointId = undefined;
      let contractId = undefined;

      if (cups) {
        const baseCups = cups.substring(0, 20);
        const sps = await prisma.supplyPoint.findMany({ 
          where: { cups: { startsWith: baseCups } },
          include: { contracts: { orderBy: { createdAt: 'desc' } } }
        });
        if (sps.length > 0) {
          supplyPointId = sps[0].id;
          const allContracts = sps.flatMap(sp => sp.contracts);
          const activeFallback = allContracts.find(c => c.status === 'ACTIVO' || c.status === 'EN_VIGOR' || c.status === 'Activo');
          if (activeFallback) {
            contractId = activeFallback.id;
          } else {
          const lastResort = allContracts.find(c => {
              const validStatuses = ['ACTIVO', 'EN_VIGOR', 'Activo', 'FINALIZADO', 'Finalizado'];
              return validStatuses.includes(c.status);
          });
          if (lastResort) contractId = lastResort.id;
          }
        }
      }

      const parsedCodFactura = codFactura ? String(codFactura) : 'SIN_COD';
      const finalFechaEmi = fechaEmiStr ? new Date(fechaEmiStr) : undefined;
      const finalSaldo = isNaN(saldo) ? 0 : saldo;

      // Buscar si ya existe para obviar y no machacar datos ni la fecha de importación
      let existingF1;
      if (parsedCodFactura !== 'SIN_COD') {
        existingF1 = await prisma.f1Invoice.findFirst({
          where: { numeroFactura: parsedCodFactura }
        });
      } else if (supplyPointId && finalFechaEmi) {
        existingF1 = await prisma.f1Invoice.findFirst({
          where: { 
            numeroFactura: 'SIN_COD',
            supplyPointId,
            fechaEmision: finalFechaEmi,
            saldoFactura: finalSaldo
          }
        });
      }

      if (existingF1) {
        continue; // La obviamos
      }

      await prisma.f1Invoice.create({
        data: {
          numeroFactura: parsedCodFactura,
          tipoDocumento: 'OtrasFacturas',
          motivoFacturacion: motivoFacturacion ? String(motivoFacturacion) : undefined,
          fechaEmision: fechaEmiStr ? new Date(fechaEmiStr) : undefined,
          saldoFactura: isNaN(saldo) ? 0 : saldo,
          baseImponible: 0,
          totalPeajes: 0,
          totalCargos: 0,
          xmlUrl: xmlUrl,
          jsonData: of,
          supplyPointId,
          contractId,
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
