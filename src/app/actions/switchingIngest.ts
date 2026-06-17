'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseSwitchingXml } from '@/lib/switching/parser';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function ingestSwitchingXmlAction(formData: FormData) {
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
    const parsedData = parseSwitchingXml(xmlString);
    
    if (parsedData.procesoBase === 'F1' || parsedData.proceso?.startsWith('F1')) {
      return { success: false, error: `El archivo ${originalName} es un fichero de facturación (F1). Por favor, súbelo desde el módulo de Facturación F1.` };
    }

    if (!parsedData.cups || !parsedData.codigoSolicitud) {
      return { success: false, error: `El archivo ${originalName} no parece un XML SCTD válido (Falta Cabecera/CUPS o Código de Solicitud).` };
    }

    // 2. Determinar si es Enviado o Recibido
    // Generalmente 01 y 03 son enviados por la comercializadora. El resto (02, 04, 05, 06, 11) son recibidos.
    const isEnviado = parsedData.paso === '01' || parsedData.paso === '03';
    const folderType = isEnviado ? 'enviados' : 'recibidos';

    // 3. Generar el nombre de archivo estandarizado
    // codigoSolicitud_version_cups_codigoComercializadora_proceso_paso.xml
    // (A falta de versión y código de comercializadora explícitos, usamos valores por defecto o extraídos si existieran)
    const standardizedName = `${parsedData.codigoSolicitud}_01_${parsedData.cups}_SP_${parsedData.proceso}_${parsedData.paso}.xml`;
    
    // Ruta en R2: switching/recibidos/C1/archivo.xml
    const r2Key = `switching/${folderType}/${parsedData.procesoBase}/${standardizedName}`;

    // 4. Subir a Cloudflare R2
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'aed-energia',
      Key: r2Key,
      Body: buffer,
      ContentType: 'application/xml',
    }));
    
    const xmlUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

    // 5. Invocar la lógica pura de DB
    const result = await processParsedSwitchingData(parsedData, xmlUrl);
    return result;

  } catch (error: any) {
    console.error('Error ingestSwitchingXmlAction:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lógica pura de base de datos para procesar un XML de Switching.
 * Se separa para poder ser invocada desde el "Sweep" de reintentos.
 */
export async function processParsedSwitchingData(parsedData: any, xmlUrl: string, existingEventId?: string) {
  let contractId: string | undefined = undefined;
  let supplyPointId: string | undefined = undefined;
  let tipoError: string | undefined = undefined;
  let warning: string | undefined = undefined;

  // Primero intentamos encontrar el contrato exacto por nSolicitud si viene en el XML
  let foundContractBySolicitud = null;
  if (parsedData.codigoSolicitud) {
    foundContractBySolicitud = await prisma.contract.findFirst({
      where: { nSolicitud: parsedData.codigoSolicitud },
      include: { supplyPoint: true }
    });
  }

  const cupsBase = parsedData.cups?.substring(0, 20);
  let supplyPoint: any = foundContractBySolicitud?.supplyPoint || null;

  if (!supplyPoint && parsedData.cups) {
    // Intentar coincidencia exacta primero
    supplyPoint = await prisma.supplyPoint.findFirst({
      where: { cups: parsedData.cups }
    });
  }

  if (!supplyPoint && cupsBase) {
    // Buscar todas las coincidencias y priorizar la que tenga contratos
    const matches = await prisma.supplyPoint.findMany({
      where: { cups: { startsWith: cupsBase } },
      include: { _count: { select: { contracts: true } } }
    });
    if (matches.length > 0) {
      matches.sort((a, b) => b._count.contracts - a._count.contracts);
      supplyPoint = matches[0] as any;
    }
  }

  if (!supplyPoint) {
    // Buscar si existe en Lead
    const leadMatch = await prisma.lead.findFirst({
      where: { cups: { startsWith: cupsBase } },
      include: { contract: { include: { supplyPoint: true } } }
    });
    if (leadMatch && leadMatch.contract && leadMatch.contract.supplyPoint) {
      supplyPoint = leadMatch.contract.supplyPoint;
    }
  }

  if (!supplyPoint) {
    tipoError = "CUPS_NO_ENCONTRADO";
    warning = "No se ha encontrado este CUPS en la base de datos ni por número de solicitud.";
  } else {
    supplyPointId = supplyPoint.id;

    // Asignar el evento a un contrato activo o en tramitación si es posible
    // IMPORTANTE: Para el proceso R1 (Reclamaciones) los pasos 02, 05, etc no significan lo mismo que en Switching.
    const { paso, procesoBase } = parsedData;

    if (paso === '06' && procesoBase !== 'R1') {
      // Regla estricta: No se puede procesar 06 si fechaPrevistaBaja está vacía (esperando al 11)
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: 'ACTIVO' }
      });
      if (activeContract) {
        contractId = activeContract.id;
        if (!activeContract.fechaPrevistaBaja) {
          tipoError = "ESPERANDO_PASO_11";
          warning = "Se recibió un paso 06 (Baja), pero el contrato no tiene fecha prevista de baja. Se pospone hasta recibir el paso 11.";
        } else if (activeContract.terminationDate) {
          tipoError = "COLISION_DE_FECHAS";
          warning = "El XML trae una fecha de baja, pero el contrato ya tiene fecha de fin. Se ha cancelado la sobreescritura.";
        } else if (parsedData.fechaActivacionBaja) {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { terminationDate: parsedData.fechaActivacionBaja, status: 'FINALIZADO' }
          });
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se recibió un paso 06 (Baja), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if (paso === '11' && procesoBase !== 'R1') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: 'ACTIVO' }
      });
      if (activeContract) {
        contractId = activeContract.id;
        if (activeContract.fechaPrevistaBaja) {
          tipoError = "COLISION_DE_FECHAS";
          warning = "El XML trae un aviso de baja, pero el contrato ya tiene fecha prevista de baja. Se ha cancelado la sobreescritura.";
        } else if (parsedData.fechaActivacionBaja) {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { fechaPrevistaBaja: parsedData.fechaActivacionBaja }
          });
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se recibió un paso 11 (Aviso baja), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if ((procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E2') && paso === '05') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: 'ACTIVO' }
      });
      if (activeContract) {
        contractId = activeContract.id;
        if (procesoBase === 'B1' || procesoBase === 'B2') {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { 
              status: 'FINALIZADO', 
              terminationDate: parsedData.fechaActivacionBaja || parsedData.fechaActivacionAlta || parsedData.fechaAR || new Date() 
            }
          });
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = `Se recibió Activación (05) de proceso ${procesoBase}, pero no se encontró un contrato ACTIVO para este CUPS.`;
      }
    } else if (paso === '05' && procesoBase !== 'R1') {
      const tramitandoContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: 'TRAMITANDO' }
      });
      if (tramitandoContract) {
        contractId = tramitandoContract.id;
        if (!tramitandoContract.fechaPrevistaActivacion) {
          tipoError = "ESPERANDO_PASO_02";
          warning = "Se recibió un paso 05 (Alta), pero el contrato no tiene fecha prevista de alta. Se pospone hasta recibir el paso 02.";
        } else if (tramitandoContract.activationDate) {
          tipoError = "COLISION_DE_FECHAS";
          warning = "El XML trae una fecha de activación, pero el contrato ya tiene una fecha de alta asignada.";
        } else if (parsedData.fechaActivacionAlta) {
          await prisma.contract.update({
            where: { id: tramitandoContract.id },
            data: { activationDate: parsedData.fechaActivacionAlta, status: 'ACTIVO' }
          });

          // Regla M1/M2: Rescindir contrato anterior
          if (procesoBase === 'M1' || procesoBase === 'M2') {
            const oldActiveContract = await prisma.contract.findFirst({
              where: { supplyPointId: supplyPoint.id, status: 'ACTIVO', id: { not: tramitandoContract.id } }
            });
            if (oldActiveContract && !oldActiveContract.terminationDate) {
              const prevDate = new Date(parsedData.fechaActivacionAlta);
              prevDate.setDate(prevDate.getDate() - 1);
              await prisma.contract.update({
                where: { id: oldActiveContract.id },
                data: { terminationDate: prevDate, status: 'FINALIZADO' }
              });
            }
          }
        }
      } else {
        tipoError = "CONTRATO_NO_TRAMITANDO";
        warning = "Se recibió un paso 05 (Alta), pero no se encontró un contrato TRAMITANDO para este CUPS.";
      }
    } else if ((procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E2') && paso === '02') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: 'ACTIVO' }
      });
      if (activeContract) {
        contractId = activeContract.id;
        if (parsedData.estadoAR === 'ACEPTADO') {
          const updateData: any = { fechaAceptacion: parsedData.fechaAR || new Date() };
          if (procesoBase === 'B1') {
            updateData.suspendido = true;
          }
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: updateData
          });
        } else if (parsedData.estadoAR === 'RECHAZADO') {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { 
              internalComments: parsedData.observaciones ? `[Rechazo ${procesoBase}] ${parsedData.observaciones}\n${activeContract.internalComments || ''}` : activeContract.internalComments
            }
          });
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = `Se recibió Aceptación/Rechazo de proceso ${procesoBase}, pero no se encontró un contrato ACTIVO para este CUPS.`;
      }
    } else if ((paso === '02' || paso === '04') && procesoBase !== 'R1') {
      const tramitandoContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: 'TRAMITANDO' }
      });
      if (tramitandoContract) {
        contractId = tramitandoContract.id;
        if (parsedData.estadoAR === 'ACEPTADO') {
          if (tramitandoContract.fechaAceptacion) {
            tipoError = "COLISION_DE_FECHAS";
            warning = "El XML trae una fecha de aceptación, pero el contrato ya tiene fecha de aceptación asignada.";
          } else if (parsedData.fechaAR) {
            await prisma.contract.update({
              where: { id: tramitandoContract.id },
              data: { fechaAceptacion: parsedData.fechaAR, fechaPrevistaActivacion: parsedData.fechaPrevActivacion }
            });
          }
        } else if (parsedData.estadoAR === 'RECHAZADO') {
          if (tramitandoContract.status === 'RECHAZADO') {
            tipoError = "COLISION_DE_ESTADO";
            warning = "El contrato ya estaba en estado RECHAZADO.";
          } else {
            await prisma.contract.update({
              where: { id: tramitandoContract.id },
              data: { 
                status: 'RECHAZADO', 
                fechaRechazo: parsedData.fechaAR,
                internalComments: parsedData.observaciones || tramitandoContract.internalComments 
              }
            });
          }
        }
      } else {
        tipoError = "CONTRATO_NO_TRAMITANDO";
        warning = "Se recibió Aceptación/Rechazo, pero no se encontró un contrato TRAMITANDO para este CUPS.";
      }
    } else {
      // Fallback genérico para otros pasos
      const anyContract = await prisma.contract.findFirst({
        where: { supplyPointId: supplyPoint.id, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
        orderBy: { createdAt: 'desc' }
      });
      if (anyContract) {
        contractId = anyContract.id;
      } else {
        warning = "No se encontró un contrato reciente para asignar este evento.";
      }
    }
  }

  // 6. Guardar SwitchingEvent
  const codCom = parsedData.codigoComercializadora ? `${parsedData.codigoComercializadora}_` : '';
  const uniqueProcess = `${parsedData.codigoSolicitud}_${codCom}${parsedData.cups}_${parsedData.proceso}_${parsedData.paso}`;

  if (existingEventId) {
    await prisma.switchingEvent.update({
      where: { id: existingEventId },
      data: {
        uniqueProcess, // Actualizar al nuevo formato por si acaso
        isResolved: !warning,
        contract: contractId ? { connect: { id: contractId } } : undefined,
        supplyPoint: supplyPointId ? { connect: { id: supplyPointId } } : undefined,
        tipoError: tipoError || null,
        warning: warning || null,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        observaciones: parsedData.observaciones,
        motivosRechazo: parsedData.motivosRechazo || null,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        codigoReclamacion: parsedData.codigoReclamacion,
      }
    });
  } else {
    await prisma.switchingEvent.upsert({
      where: { uniqueProcess },
      create: {
        uniqueProcess,
        fechaSolicitud: parsedData.fechaSolicitud,
        codigoSolicitud: parsedData.codigoSolicitud,
        proceso: parsedData.proceso,
        procesoBase: parsedData.procesoBase,
        paso: parsedData.paso,
        estadoAR: parsedData.estadoAR,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        observaciones: parsedData.observaciones,
        motivosRechazo: parsedData.motivosRechazo,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        codigoReclamacion: parsedData.codigoReclamacion,
        xmlUrl,
        isResolved: !warning,
        contractId,
        supplyPointId,
        tipoError,
        warning,
      },
      update: {
        isResolved: !warning,
        contractId: contractId || undefined,
        supplyPointId: supplyPointId || undefined,
        tipoError: tipoError || null,
        warning: warning || null,
        observaciones: parsedData.observaciones,
        motivosRechazo: parsedData.motivosRechazo || null,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        codigoReclamacion: parsedData.codigoReclamacion,
      }
    });
  }

  return { success: true, warning };
}
