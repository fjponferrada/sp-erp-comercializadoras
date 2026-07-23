'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseSwitchingXml } from '@/lib/switching/parser';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function ingestWorkerXml(file: File) {
  return await handleFileOrZip(file, ingestCore);
}

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

    return await handleFileOrZip(file, ingestCore);
  } catch (error: any) {
    console.error('Error ingestSwitchingXmlAction:', error);
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

async function ingestCore(file: File) {
  try {

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

    // 5. Check if already processed successfully to prevent duplicate warnings
    const codCom = parsedData.codigoComercializadora ? `${parsedData.codigoComercializadora}_` : '';
    const uniqueProcess = `${parsedData.codigoSolicitud}_${codCom}${parsedData.cups}_${parsedData.proceso}_${parsedData.paso}`;
    const existingEvent = await prisma.switchingEvent.findFirst({ where: { uniqueProcess } });
    const existingEventId = existingEvent?.id || null;

    if (existingEvent && existingEvent.isResolved) {
      console.log(`[SALTADO] El fichero XML ${originalName} ya fue procesado con éxito anteriormente.`);
      return { success: true, message: 'Fichero previamente procesado con éxito.' };
    }

    // Si no fue procesado o dio error, continuamos:
    
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
    console.error('Error ingestCore:', error);
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
  let possibleSpIds: string[] = [];
  let tipoError: string | undefined = undefined;
  let warning: string | undefined = undefined;

  // Calcular uniqueProcess en este scope para usarlo al guardar el evento
  const codCom = parsedData.codigoComercializadora ? `${parsedData.codigoComercializadora}_` : '';
  const uniqueProcess = `${parsedData.codigoSolicitud}_${codCom}${parsedData.cups}_${parsedData.proceso}_${parsedData.paso}`;

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
  if (supplyPoint) {
    possibleSpIds = [supplyPoint.id];
  }

  if (!supplyPoint && parsedData.cups) {
    const cupsBase = parsedData.cups.substring(0, 20);
    // Find supply points starting with cupsBase. If multiple, prefer the ones with the exact NIF if we have it
    const matches = await prisma.supplyPoint.findMany({
      where: { cups: { startsWith: cupsBase } },
      include: { 
        client: true,
        _count: { select: { contracts: true } }
      }
    });

    if (matches.length > 0) {
      if (parsedData.nifCliente) {
        // Try to find the supply point belonging to the client with this NIF
        const nifMatch = matches.find(m => m.client?.vatNumber?.toUpperCase() === parsedData.nifCliente);
        if (nifMatch) supplyPoint = nifMatch as any;
      }

      if (!supplyPoint) {
        matches.sort((a, b) => b._count.contracts - a._count.contracts);
        supplyPoint = matches[0] as any;
      }
      possibleSpIds = matches.map(m => m.id);
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

    if (paso === '06' && ['C1', 'C2'].includes(procesoBase)) {
      // Regla estricta: No se puede procesar 06 si fechaPrevistaBaja está vacía (esperando al 11)
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
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

          // Rechazo en cadena: versiones M1 posteriores pendientes
          if (activeContract.contractCode) {
            await prisma.contract.updateMany({
              where: {
                contractCode: activeContract.contractCode,
                tipo: 'M1',
                version: { gt: activeContract.version },
                status: { in: ['BORRADOR', 'Borrador', 'ACEPTADO', 'Aceptado', 'TRAMITANDO', 'Tramitando'] }
              },
              data: { 
                status: 'RECHAZADO',
                internalComments: 'Rechazado automático: CUPS causa baja antes de la activación de este contrato.'
              }
            });
          }

          // Rechazo en cadena: renovaciones huérfanas para este CUPS
          await prisma.contract.updateMany({
            where: {
              supplyPointId,
              tipo: 'R',
              status: { in: ['BORRADOR', 'Borrador', 'ACEPTADO', 'Aceptado', 'TRAMITANDO', 'Tramitando'] }
            },
            data: { 
              status: 'RECHAZADO',
              internalComments: 'Rechazado automático: CUPS causa baja antes de la activación de este contrato.'
            }
          });
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se recibió un paso 06 (Baja), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if (paso === '11' && ['C1', 'C2'].includes(procesoBase)) {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
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
    } else if (paso === '10' && ['C1', 'C2'].includes(procesoBase)) {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        
        // Si el contrato tenía una fecha de baja prevista (probablemente por un paso 11 anterior), 
        // la borramos porque el cambio de comercializador ha sido anulado.
        if (activeContract.fechaPrevistaBaja) {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { fechaPrevistaBaja: null }
          });
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se recibió un paso 10 (Anulación de cambio), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if ((procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E1') && paso === '05') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        if (procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E1') {
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
    } else if (procesoBase === 'M2' && paso === '05') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        
        const { createUnilateralModificationAction } = await import('@/app/actions/contractModification');
        const modRes = await createUnilateralModificationAction(activeContract.id, parsedData);
        if (modRes.error) {
          tipoError = "ERROR_MODIFICACION_UNILATERAL";
          warning = `Error al procesar la modificación M2: ${modRes.error}`;
        } else {
          contractId = modRes.newContractId;
        }
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se recibió un paso 05 de M2 (Mod. Unilateral), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if (paso === '05' && procesoBase !== 'R1') {
      const tramitandoContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['TRAMITANDO', 'Tramitando'] } },
        include: { supplyPoint: true, product: true },
        orderBy: { createdAt: 'desc' }
      });
      if (tramitandoContract) {
        supplyPoint = tramitandoContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = tramitandoContract.id;
        if (!tramitandoContract.fechaPrevistaActivacion) {
          tipoError = "ESPERANDO_PASO_02";
          warning = "Se recibió un paso 05 (Alta), pero el contrato no tiene fecha prevista de alta. Se pospone hasta recibir el paso 02.";
        } else if (tramitandoContract.activationDate) {
          tipoError = "COLISION_DE_FECHAS";
          warning = "El XML trae una fecha de activación, pero el contrato ya tiene una fecha de alta asignada.";
        } else if (parsedData.fechaActivacionAlta) {
          const isA3C1C2 = ['A3', 'C1', 'C2'].includes(procesoBase);
          await prisma.contract.update({
            where: { id: tramitandoContract.id },
            data: { 
              activationDate: parsedData.fechaActivacionAlta, 
              status: 'ACTIVO',
              ...(isA3C1C2 && { permanenceStartDate: parsedData.fechaActivacionAlta })
            }
          });

          // Activar el autoconsumo en el CUPS y actualizar datos técnicos del contrato tramitado
          const contractData = tramitandoContract.airtableData as any;
          const updateSpData: any = {
            p1c: parsedData.potenciasContratadas?.[0] ?? tramitandoContract.p1c,
            p2c: parsedData.potenciasContratadas?.[1] ?? tramitandoContract.p2c,
            p3c: parsedData.potenciasContratadas?.[2] ?? tramitandoContract.p3c,
            p4c: parsedData.potenciasContratadas?.[3] ?? tramitandoContract.p4c,
            p5c: parsedData.potenciasContratadas?.[4] ?? tramitandoContract.p5c,
            p6c: parsedData.potenciasContratadas?.[5] ?? tramitandoContract.p6c,
            p1p: tramitandoContract.p1p,
            p2p: tramitandoContract.p2p,
            p3p: tramitandoContract.p3p,
            p4p: tramitandoContract.p4p,
            p5p: tramitandoContract.p5p,
            p6p: tramitandoContract.p6p
          };

          const modifiedTariff = typeof contractData?.tarifa === 'string' 
            ? contractData.tarifa 
            : (Array.isArray(contractData?.Tarifa) ? contractData.Tarifa[0] : contractData?.Tarifa);

          if (parsedData.tarifaATR) {
            updateSpData.tariff = parsedData.tarifaATR;
          } else if (modifiedTariff) {
            updateSpData.tariff = modifiedTariff;
          } else if (tramitandoContract.product?.tariff) {
            updateSpData.tariff = tramitandoContract.product.tariff;
          }

          if (contractData?.isAutoconsumoModification || contractData?.selfConsumptionType || supplyPoint.selfConsumptionType || parsedData.tipoAutoconsumo) {
            updateSpData.hasSelfConsumption = true;
            if (parsedData.tipoAutoconsumo) {
              updateSpData.selfConsumptionType = parsedData.tipoAutoconsumo;
            }
          }

          await prisma.supplyPoint.update({
            where: { id: supplyPoint.id },
            data: updateSpData
          });

          // Regla M1/M2: Rescindir contrato anterior
          if (procesoBase === 'M1' || procesoBase === 'M2') {
            const oldActiveContract = await prisma.contract.findFirst({
              where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] }, id: { not: tramitandoContract.id } }
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
      } else if (procesoBase === 'E2' || procesoBase === 'M2') {
        const lastContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['BORRADOR', 'Borrador', 'RECHAZADO', 'Rechazado'] } },
          include: { product: true },
          orderBy: { terminationDate: 'desc' }
        });
        
        if (lastContract) {
          const { 
            id, createdAt, updatedAt, 
            airtableId, previousContractId, docusignEnvelopeId,
            product,
            ...cloneData 
          } = lastContract;
          
          // Get the maximum version for this contract code
          const maxVersionContract = await prisma.contract.findFirst({
            where: { contractCode: lastContract.contractCode, brandId: lastContract.brandId },
            orderBy: { version: 'desc' }
          });
          const nextVersion = maxVersionContract ? maxVersionContract.version + 1 : lastContract.version + 1;

          const newContract = await prisma.contract.create({
            data: {
              ...cloneData as any,
              version: nextVersion,
              status: 'ACTIVO',
              activationDate: parsedData.fechaActivacionAlta || new Date(),
              terminationDate: null,
              previousContractId: lastContract.id
            }
          });
          
          if (procesoBase === 'M2') {
            if (lastContract.status.toUpperCase() === 'ACTIVO') {
              const prevDate = new Date(parsedData.fechaActivacionAlta || new Date());
              prevDate.setDate(prevDate.getDate() - 1);
              await prisma.contract.update({
                where: { id: lastContract.id },
                data: { terminationDate: prevDate, status: 'FINALIZADO' }
              });
            }

            const contractData = lastContract.airtableData as any;
            const modifiedTariff = typeof contractData?.tarifa === 'string' 
              ? contractData.tarifa 
              : (Array.isArray(contractData?.Tarifa) ? contractData.Tarifa[0] : contractData?.Tarifa);

            const updateSpData: any = {
              p1c: parsedData.potenciasContratadas?.[0] ?? lastContract.p1c,
              p2c: parsedData.potenciasContratadas?.[1] ?? lastContract.p2c,
              p3c: parsedData.potenciasContratadas?.[2] ?? lastContract.p3c,
              p4c: parsedData.potenciasContratadas?.[3] ?? lastContract.p4c,
              p5c: parsedData.potenciasContratadas?.[4] ?? lastContract.p5c,
              p6c: parsedData.potenciasContratadas?.[5] ?? lastContract.p6c,
            };

            if (parsedData.tarifaATR) {
              updateSpData.tariff = parsedData.tarifaATR;
            } else if (modifiedTariff) {
              updateSpData.tariff = modifiedTariff;
            } else if (lastContract.product?.tariff) {
              updateSpData.tariff = lastContract.product.tariff;
            }

            if (parsedData.tipoAutoconsumo) {
              updateSpData.hasSelfConsumption = true;
              updateSpData.selfConsumptionType = parsedData.tipoAutoconsumo;
            }

            await prisma.supplyPoint.update({
              where: { id: supplyPoint.id },
              data: updateSpData
            });

            warning = "Se ha procesado un M2 automático sin contrato TRAMITANDO. Se ha clonado el último contrato activo y actualizado el Supply Point con los datos del XML.";
          } else {
            warning = "Se ha activado una Reposición (E2_05) no iniciada por el sistema. Se ha clonado el último contrato y puesto en ACTIVO.";
          }
        } else {
          tipoError = "CONTRATO_NO_ENCONTRADO_PARA_CLONAR";
          warning = `Se recibió un paso 05 de ${procesoBase} inesperado, pero no se encontró un contrato previo para clonar.`;
        }
      } else {
        tipoError = "CONTRATO_NO_TRAMITANDO";
        warning = "Se recibió un paso 05 (Alta), pero no se encontró un contrato TRAMITANDO para este CUPS.";
      }
    } else if ((procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E1') && paso === '02') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        if (parsedData.estadoAR === 'ACEPTADO') {
          const updateData: any = {};
          if (procesoBase === 'B1' || procesoBase === 'E1') {
            updateData.suspendido = true;
            // Guardamos la fecha real de aceptación del B1/E1 en el nuevo campo
            if (parsedData.fechaAR) {
              updateData.fechaAceptacionBaja = parsedData.fechaAR;
            } else {
              updateData.fechaAceptacionBaja = new Date();
            }
            // Si además nos mandan la fecha prevista de corte, la guardamos también
            if (parsedData.fechaPrevActivacion) {
              updateData.fechaPrevistaBaja = parsedData.fechaPrevActivacion;
            }
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
    } else if (procesoBase === 'E1' && paso === '04') {
      const contract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active', 'FINALIZADO', 'Finalizado'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (contract) {
        supplyPointId = contract.supplyPointId;
        contractId = contract.id;
        await prisma.contract.update({
          where: { id: contract.id },
          data: { 
            internalComments: parsedData.observaciones ? `[Rechazo E1] ${parsedData.observaciones}\n${contract.internalComments || ''}` : contract.internalComments
          }
        });
        tipoError = "E1_RECHAZADO";
        warning = "Rechazo de Desistimiento (E1_04) recibido. Revisar los comentarios internos del contrato.";
      } else {
        tipoError = "CONTRATO_NO_ACTIVO_NI_FINALIZADO";
        warning = "Se recibió un Rechazo de Desistimiento (E1_04), pero no se encontró un contrato ACTIVO o FINALIZADO.";
      }
    } else if ((paso === '02' || paso === '04') && procesoBase !== 'R1') {
      const tramitandoContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['TRAMITANDO', 'Tramitando'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (tramitandoContract) {
        supplyPoint = tramitandoContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = tramitandoContract.id;
        if (parsedData.estadoAR === 'ACEPTADO') {
          const contractData = tramitandoContract.airtableData as any;
          const isSubrogacion = procesoBase === 'M1' && (
            tramitandoContract.tipoC2 === 'S' || 
            tramitandoContract.tipoC2 === 'M1_S' || 
            tramitandoContract.tipo === 'M1-S' ||
            contractData?.isSubrogation === true ||
            contractData?.tipoC2 === 'S' ||
            contractData?.tipoSolicitudAdministrativa === 'S' ||
            contractData?.tramitationType === 'Modificación de datos administrativos'
          );

          if (tramitandoContract.fechaAceptacion && !isSubrogacion) {
            tipoError = "COLISION_DE_FECHAS";
            warning = "El XML trae una fecha de aceptación, pero el contrato ya tiene fecha de aceptación asignada.";
          } else if (parsedData.fechaAR || (isSubrogacion && tramitandoContract.fechaAceptacion)) {
            
            const activationDate = parsedData.fechaPrevActivacion || parsedData.fechaAR || tramitandoContract.fechaPrevistaActivacion || tramitandoContract.fechaAceptacion;
            
            await prisma.contract.update({
              where: { id: tramitandoContract.id },
              data: { 
                fechaAceptacion: parsedData.fechaAR || tramitandoContract.fechaAceptacion, 
                fechaPrevistaActivacion: parsedData.fechaPrevActivacion || tramitandoContract.fechaPrevistaActivacion,
                ...(isSubrogacion ? { 
                  status: 'ACTIVO', 
                  fechaActivacion: activationDate 
                } : {})
              }
            });
            
            if (isSubrogacion) {
               warning = "Activado automáticamente por ser subrogación (M1 tipo S). No se esperará al paso 05.";
               
               const oldActiveContract = await prisma.contract.findFirst({
                 where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] }, id: { not: tramitandoContract.id } }
               });
               if (oldActiveContract && !oldActiveContract.terminationDate) {
                 const prevDate = new Date(activationDate);
                 prevDate.setDate(prevDate.getDate() - 1);
                 await prisma.contract.update({
                   where: { id: oldActiveContract.id },
                   data: { terminationDate: prevDate, status: 'FINALIZADO' }
                 });
               }
            }
          }
        } else if (parsedData.estadoAR === 'RECHAZADO') {
          if (tramitandoContract.status === 'RECHAZADO' || tramitandoContract.status === 'Rechazo Distribuidora') {
            tipoError = "COLISION_DE_ESTADO";
            warning = "El contrato ya estaba en estado RECHAZADO o Rechazo Distribuidora.";
          } else {
            await prisma.contract.update({
              where: { id: tramitandoContract.id },
              data: { 
                status: 'Rechazo Distribuidora', 
                fechaRechazo: parsedData.fechaAR,
                internalComments: parsedData.observaciones ? `[Rechazo ${procesoBase}] ${parsedData.observaciones}\n${tramitandoContract.internalComments || ''}` : tramitandoContract.internalComments 
              }
            });
          }
        }
      } else {
        tipoError = "CONTRATO_NO_TRAMITANDO";
        warning = "Se recibió Aceptación/Rechazo, pero no se encontró un contrato TRAMITANDO para este CUPS.";
      }
    } else if (procesoBase === 'R1') {
      // Dejamos que caiga al fallback genérico o no asignamos nada especial,
      // simplemente guardamos el evento en SwitchingEvent y NO creamos Ticket.
    } else if (paso === '01' && ['A3', 'C1', 'C2', 'M1', 'E2'].includes(procesoBase)) {
      // Buscar el contrato en estado ACEPTADO o Rechazo Distribuidora para este CUPS
      const acceptedContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACEPTADO', 'Aceptado', 'Rechazo Distribuidora', 'RECHAZADO', 'Rechazado', 'BORRADOR', 'Borrador'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });

      if (acceptedContract) {
        supplyPoint = acceptedContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = acceptedContract.id;

        // Pasar a TRAMITANDO
        await prisma.contract.update({
          where: { id: acceptedContract.id },
          data: { 
            status: 'TRAMITANDO',
            nSolicitud: parsedData.codigoSolicitud || acceptedContract.nSolicitud
          }
        });
      } else {
        // Si no hay un contrato ACEPTADO, usamos el fallback habitual para enlazar el evento al último contrato
        const anyContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
          include: { supplyPoint: true },
          orderBy: { createdAt: 'desc' }
        });
        if (anyContract) {
          supplyPoint = anyContract.supplyPoint;
          supplyPointId = supplyPoint.id;
          contractId = anyContract.id;
        } else {
          warning = "No se encontró un contrato reciente para asignar este evento.";
        }
        tipoError = "CONTRATO_NO_ACEPTADO_O_RECHAZADO";
        if (!warning) warning = `Se recibió un paso 01 (${procesoBase}), pero no se encontró un contrato en estado ACEPTADO o Rechazo Distribuidora para pasarlo a TRAMITANDO.`;
      }
    } else if (procesoBase === 'D1' && paso === '01') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        
        // Actualizar datos de autoconsumo en SupplyPoint si existen en el XML
        if (parsedData.cau || parsedData.tipoAutoconsumo) {
          const updateData: any = {};
          if (parsedData.cau) updateData.cau = parsedData.cau;
          if (parsedData.tipoAutoconsumo) updateData.selfConsumptionType = parsedData.tipoAutoconsumo;
          if (parsedData.cauSubtype) updateData.cauSubtype = parsedData.cauSubtype;
          if (parsedData.cauCollective) updateData.cauCollective = parsedData.cauCollective;
          if (parsedData.cil) updateData.cil = parsedData.cil;
          if (parsedData.generatorTechnology) updateData.generatorTechnology = parsedData.generatorTechnology;
          if (parsedData.installedPowerGen !== undefined) updateData.installedPowerGen = parsedData.installedPowerGen;
          if (parsedData.installationType) updateData.installationType = parsedData.installationType;
          
          updateData.tipoCups = parsedData.tipoCups || '01';
          updateData.meteringScheme = parsedData.meteringScheme || 'A';
          
          await prisma.supplyPoint.update({
            where: { id: supplyPointId },
            data: updateData
          });
        }
        
        tipoError = "D1_NOTIFICACION_REVISION";
        warning = "Notificación D1 recibida (ej. Autoconsumo). Revisar y decidir si enviar rechazo (Paso 02) antes de 10 días.";
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se recibió un paso 01 de D1 (Notificación), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if (procesoBase === 'E1' && paso === '01') {
      const activeContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        
        await prisma.contract.update({
          where: { id: activeContract.id },
          data: { 
            internalComments: `[Aviso] Se ha enviado solicitud de Desistimiento (E1) a la distribuidora.\n${activeContract.internalComments || ''}`
          }
        });
      } else {
        tipoError = "CONTRATO_NO_ACTIVO";
        warning = "Se envió un Desistimiento (E1_01), pero no se encontró un contrato ACTIVO para este CUPS.";
      }
    } else if (procesoBase === 'E1' && paso === '11') {
      const lastFinalizedContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { in: ['FINALIZADO', 'Finalizado'] } },
        orderBy: { terminationDate: 'desc' }
      });
      if (lastFinalizedContract) {
        supplyPointId = lastFinalizedContract.supplyPointId;
        const { 
          id, createdAt, updatedAt, 
          airtableId, previousContractId, docusignEnvelopeId,
          terminationDate,
          ...cloneData 
        } = lastFinalizedContract;
        
        const maxVersionContract = await prisma.contract.findFirst({
          where: { contractCode: lastFinalizedContract.contractCode, brandId: lastFinalizedContract.brandId },
          orderBy: { version: 'desc' }
        });
        const newVersion = maxVersionContract ? (maxVersionContract.version || 0) + 1 : (lastFinalizedContract.version || 0) + 1;
        
        const newContract = await prisma.contract.create({
          data: {
            ...cloneData as any,
            status: 'TRAMITANDO',
            version: newVersion,
            fechaPrevistaActivacion: parsedData.fechaPrevActivacion || new Date(),
            internalComments: `[Aviso] Contrato clonado automáticamente por E1_11 (Aceptación de desistimiento para recuperar cliente).\n${lastFinalizedContract.internalComments || ''}`
          }
        });
        contractId = newContract.id;
        warning = "Aceptación de Desistimiento (E1_11) recibida. Se ha clonado el último contrato finalizado y puesto en TRAMITANDO.";
      } else {
        tipoError = "CONTRATO_FINALIZADO_NO_ENCONTRADO";
        warning = "Se recibió un E1_11, pero no se encontró un contrato FINALIZADO para clonar.";
      }
    } else if (procesoBase === 'E1' && paso === '06') {
      const tramitandoContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: 'TRAMITANDO' },
        orderBy: { createdAt: 'desc' }
      });
      if (tramitandoContract) {
        supplyPointId = tramitandoContract.supplyPointId;
        await prisma.contract.update({
          where: { id: tramitandoContract.id },
          data: { 
            status: 'ACTIVO',
            activationDate: parsedData.fechaActivacionAlta || new Date(),
            internalComments: `[Aviso] Activación por Desistimiento (E1_06). Cliente recuperado.\n${tramitandoContract.internalComments || ''}`
          }
        });
        contractId = tramitandoContract.id;
        warning = "Activación por Desistimiento (E1_06) recibida. El contrato en TRAMITANDO ha pasado a ACTIVO.";
      } else {
        tipoError = "CONTRATO_TRAMITANDO_NO_ENCONTRADO";
        warning = "Se recibió un E1_06, pero no se encontró el contrato TRAMITANDO previo (E1_11).";
      }
    } else if (procesoBase === 'E2' && paso !== '05' && paso !== '02') {
      // Pasos del proceso de Reposición que no se auto-tramitan (01, 04, 06, 14, 15)
      const anyContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (anyContract) {
        supplyPoint = anyContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        supplyPointId = anyContract.supplyPointId;
        contractId = anyContract.id;
      }
      
      if (paso === '14') {
        tipoError = "E2_CONSULTA_REPOSICION";
        warning = "Consulta de Reposición (E2_14) recibida. Se debe Aceptar (15) o Rechazar (15) la reposición solicitada por la otra comercializadora.";
      } else if (paso === '06') {
        tipoError = "E2_NOTIFICACION_BAJA";
        warning = "Notificación de Activación de Reposición con baja (E2_06). Se nos ha quitado el suministro por una reposición.";
      } else {
        tipoError = `E2_PASO_${paso}`;
        warning = `Aviso de Reposición (paso ${paso}) recibido y pendiente de revisión.`;
      }
    } else if (procesoBase === 'E1' && ['03', '13'].includes(paso!)) {
      const contract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
        orderBy: { createdAt: 'desc' }
      });
      if (contract) {
        supplyPointId = contract.supplyPointId;
        contractId = contract.id;
      }
      tipoError = `E1_INCIDENCIA_${paso}`;
      warning = `Incidencia recibida en proceso de Desistimiento (paso ${paso}). Por favor, revisar manualmente.`;
    } else if (procesoBase === 'E1' && ['08', '09', '10'].includes(paso!)) {
      const contract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds } },
        orderBy: { createdAt: 'desc' }
      });
      if (contract) {
        supplyPointId = contract.supplyPointId;
        contractId = contract.id;
        if (contract.status === 'TRAMITANDO') {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { 
              status: 'ANULADO',
              internalComments: `[Aviso] El proceso de recuperación por desistimiento ha sido ANULADO (paso ${paso}).\n${contract.internalComments || ''}`
            }
          });
        } else if (contract.suspendido) {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { 
              suspendido: false,
              internalComments: `[Aviso] El proceso de desistimiento ha sido ANULADO (paso ${paso}). Se levanta la suspensión.\n${contract.internalComments || ''}`
            }
          });
        }
      }
      warning = `Anulación de proceso de Desistimiento (paso ${paso}) procesada.`;
    } else {
      // Fallback genérico para otros pasos
      const anyContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
        include: { supplyPoint: true },
        orderBy: { createdAt: 'desc' }
      });
      if (anyContract) {
        supplyPoint = anyContract.supplyPoint;
        supplyPointId = anyContract.supplyPointId;
        contractId = anyContract.id;
      } else {
        warning = "No se encontró un contrato reciente para asignar este evento.";
      }
    }
  }

  // 6. Guardar SwitchingEvent
  if (existingEventId) {
    await prisma.switchingEvent.update({
      where: { id: existingEventId },
      data: {
        uniqueProcess: uniqueProcess, // Actualizar al nuevo formato por si acaso
        isResolved: (!warning || (parsedData.procesoBase === 'E2' && parsedData.paso === '05')),
        contract: contractId ? { connect: { id: contractId } } : undefined,
        supplyPoint: supplyPointId ? { connect: { id: supplyPointId } } : undefined,
        tipoError: tipoError || null,
        warning: warning || null,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        observaciones: parsedData.observaciones || parsedData.tipoDeReposicion,
        motivosRechazo: parsedData.motivosRechazo || null,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        codigoReclamacion: parsedData.codigoReclamacion,
      }
    });
  } else {
    await prisma.switchingEvent.upsert({
      where: { uniqueProcess: uniqueProcess },
      create: {
        uniqueProcess,
        fechaSolicitud: parsedData.fechaSolicitud,
        codigoSolicitud: parsedData.codigoSolicitud,
        proceso: parsedData.proceso,
        procesoBase: parsedData.procesoBase,
        paso: parsedData.paso,
        estadoAR: parsedData.estadoAR,
        tipoReclamacion: parsedData.tipoReclamacion,
        subtipoReclamacion: parsedData.subtipoReclamacion,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        observaciones: parsedData.observaciones || parsedData.tipoDeReposicion,
        motivosRechazo: parsedData.motivosRechazo,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        codigoReclamacion: parsedData.codigoReclamacion,
        xmlUrl,
        isResolved: (!warning || (parsedData.procesoBase === 'E2' && parsedData.paso === '05')),
        contractId,
        supplyPointId,
        tipoError,
        warning,
      },
      update: {
        isResolved: (!warning || (parsedData.procesoBase === 'E2' && parsedData.paso === '05')),
        contractId: contractId || undefined,
        supplyPointId: supplyPointId || undefined,
        tipoError: tipoError || null,
        warning: warning || null,
        tipoReclamacion: parsedData.tipoReclamacion || undefined,
        subtipoReclamacion: parsedData.subtipoReclamacion || undefined,
        observaciones: parsedData.observaciones || parsedData.tipoDeReposicion,
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
