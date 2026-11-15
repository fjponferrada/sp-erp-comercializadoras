'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { parseSwitchingXml, decodeXmlBuffer, ParsedSwitchingData } from '@/lib/switching/parser';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import AdmZip from 'adm-zip';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

let cachedOwnReeCodes: { codes: string[]; expiresAt: number } | null = null;

export async function getOwnReeCodes(): Promise<string[]> {
  const now = Date.now();
  if (cachedOwnReeCodes && cachedOwnReeCodes.expiresAt > now) {
    return cachedOwnReeCodes.codes;
  }
  try {
    const companies = await prisma.company.findMany({
      where: { codigoRee: { not: null } },
      select: { codigoRee: true },
    });
    const codes = Array.from(
      new Set(
        companies
          .map(c => c.codigoRee?.trim())
          .filter((c): c is string => Boolean(c))
      )
    );
    const finalCodes = codes.length > 0 ? codes : ['1713'];
    cachedOwnReeCodes = { codes: finalCodes, expiresAt: now + 5 * 60 * 1000 };
    return finalCodes;
  } catch {
    return ['1713'];
  }
}

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
    const zipEntries = zip.getEntries().filter(
      e => !e.isDirectory && /\.(xml|\d+)$/i.test(e.entryName)
    );

    let successCount = 0;
    const errors: string[] = [];
    const CONCURRENCY = 10;

    for (let i = 0; i < zipEntries.length; i += CONCURRENCY) {
      const batch = zipEntries.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (zipEntry) => {
          const xmlBuffer = zipEntry.getData();
          const fakeFile = {
            name: zipEntry.name,
            arrayBuffer: async () =>
              xmlBuffer.buffer.slice(xmlBuffer.byteOffset, xmlBuffer.byteOffset + xmlBuffer.byteLength) as ArrayBuffer,
          } as unknown as File;

          try {
            const res = await coreFn(fakeFile);
            return { name: zipEntry.name, res };
          } catch (e: any) {
            return { name: zipEntry.name, res: { success: false, error: e.message } };
          }
        })
      );

      for (const item of results) {
        if (item.res.success) {
          successCount += item.res.count || 1;
        } else {
          errors.push(`${item.name}: ${item.res.error}`);
        }
      }
    }

    return {
      success: errors.length === 0 || successCount > 0,
      count: successCount,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    };
  } else {
    return await coreFn(file);
  }
}

function buildSwitchingUniqueProcess(parsedData: any): string {
  const codCom = parsedData.codigoComercializadora ? `${parsedData.codigoComercializadora}_` : '';
  const cupsKey = parsedData.cups || 'SINCUPS';
  const r1SeqSuffix =
    parsedData.procesoBase === 'R1' &&
    ['03', '04', '08', '09'].includes(parsedData.paso || '') &&
    parsedData.secuencialSolicitud &&
    parsedData.secuencialSolicitud !== '01'
      ? `_${parsedData.secuencialSolicitud}`
      : '';
  return `${parsedData.codigoSolicitud}_${codCom}${cupsKey}_${parsedData.proceso}_${parsedData.paso}${r1SeqSuffix}`;
}

export async function ingestXmlStringInternal(xmlContent: string, fileName: string) {
  const buf = Buffer.from(xmlContent, 'utf-8');
  const fakeFile = {
    name: fileName,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  } as unknown as File;
  return await ingestCore(fakeFile);
}

async function ingestCore(file: File) {
  try {
    const originalName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const xmlString = decodeXmlBuffer(buffer);

    // 1. Parsear el XML con los códigos REE de nuestras comercializadoras
    const ownReeCodes = await getOwnReeCodes();
    const parsedData = parseSwitchingXml(xmlString, ownReeCodes);

    if (parsedData.procesoBase === 'F1' || parsedData.proceso?.startsWith('F1')) {
      return {
        success: false,
        error: `El archivo ${originalName} es un fichero de facturación (F1). Por favor, súbelo desde el módulo de Facturación F1.`,
      };
    }

    if (!parsedData.codigoSolicitud || (!parsedData.cups && !['R1', 'Q1'].includes(parsedData.procesoBase))) {
      return {
        success: false,
        error: `El archivo ${originalName} no parece un XML SCTD válido (Falta Cabecera/CUPS o Código de Solicitud).`,
      };
    }

    // 2. Determinar carpeta R2 en base al análisis exacto del parser (Remitente/Destinatario + matriz CNMC)
    const folderType = parsedData.isEnviado ? 'enviados' : 'recibidos';

    // 3. Generar el nombre de archivo estandarizado
    const seqVer = parsedData.secuencialSolicitud || '01';
    const cupsKey = parsedData.cups || 'SINCUPS';
    const standardizedName = `${parsedData.codigoSolicitud}_${seqVer}_${cupsKey}_SP_${parsedData.proceso}_${parsedData.paso}.xml`;

    const r2Key = `switching/${folderType}/${parsedData.procesoBase}/${standardizedName}`;

    // 4. Comprobar si ya fue procesado con éxito para evitar reprocesos innecesarios
    const uniqueProcess = buildSwitchingUniqueProcess(parsedData);
    const existingEvent = await prisma.switchingEvent.findFirst({ where: { uniqueProcess } });

    if (existingEvent && existingEvent.isResolved && !existingEvent.warning) {
      return { success: true, message: 'Fichero previamente procesado con éxito.' };
    }

    // 5. Subir a Cloudflare R2
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'aed-energia',
        Key: r2Key,
        Body: buffer,
        ContentType: 'application/xml',
      })
    );

    const xmlUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

    // 6. Invocar la lógica pura de DB
    return await processParsedSwitchingData(parsedData, xmlUrl, existingEvent?.id);
  } catch (error: any) {
    console.error('Error ingestCore:', error);
    return { success: false, error: error.message };
  }
}

const ACTIVE_STATUSES = ['ACTIVO', 'Activo', 'ACTIVE', 'Active'];
const TRAMITANDO_STATUSES = ['TRAMITANDO', 'Tramitando'];
const NON_ACTIVE_PENDING_STATUSES = [
  'BORRADOR',
  'Borrador',
  'PENDIENTE',
  'Pendiente',
  'FIRMADO',
  'Firmado',
  'ACEPTADO',
  'Aceptado',
  'TRAMITANDO',
  'Tramitando',
];

/**
 * Busca el contrato ACTIVO vigente priorizando la versión más alta y fecha de activación más reciente.
 */
async function findHighestActiveContract(possibleSpIds: string[]) {
  return prisma.contract.findFirst({
    where: {
      supplyPointId: { in: possibleSpIds },
      status: { in: ACTIVE_STATUSES },
    },
    include: { supplyPoint: true },
    orderBy: [{ version: 'desc' }, { activationDate: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Cancela en cascada versiones posteriores en borrador/trámite y renovaciones huérfanas
 * cuando un suministro causa baja definitiva (C1_06, C2_06, T1_06, B1_05, B2_05, E2_06).
 */
async function cancelSubsequentAndOrphanContracts(
  activeContract: { id: string; contractCode: string | null; version: number; supplyPointId: string },
  possibleSpIds: string[],
  motivo: string
) {
  if (activeContract.contractCode) {
    await prisma.contract.updateMany({
      where: {
        contractCode: activeContract.contractCode,
        version: { gt: activeContract.version },
        status: { in: NON_ACTIVE_PENDING_STATUSES },
      },
      data: {
        status: 'RECHAZADO',
        internalComments: `Cancelado automático (${motivo}): el suministro causó baja antes de la activación de esta versión.`,
      },
    });
  }

  await prisma.contract.updateMany({
    where: {
      supplyPointId: { in: possibleSpIds },
      id: { not: activeContract.id },
      tipo: 'R',
      status: { in: NON_ACTIVE_PENDING_STATUSES },
    },
    data: {
      status: 'RECHAZADO',
      internalComments: `Cancelado automático (${motivo}): el suministro causó baja antes de la renovación.`,
    },
  });
}

/**
 * Sincroniza de forma atómica los datos maestros del contrato activado hacia SupplyPoint (Reglas 71 y 72).
 */
async function syncContractDataToSupplyPoint(
  supplyPoint: any,
  contract: any,
  parsedData: ParsedSwitchingData
) {
  const contractData = (contract.airtableData as any) || {};
  const updateSpData: any = {
    p1c: parsedData.potenciasContratadas?.[0] ?? contract.p1c ?? supplyPoint.p1c,
    p2c: parsedData.potenciasContratadas?.[1] ?? contract.p2c ?? supplyPoint.p2c,
    p3c: parsedData.potenciasContratadas?.[2] ?? contract.p3c ?? supplyPoint.p3c,
    p4c: parsedData.potenciasContratadas?.[3] ?? contract.p4c ?? supplyPoint.p4c,
    p5c: parsedData.potenciasContratadas?.[4] ?? contract.p5c ?? supplyPoint.p5c,
    p6c: parsedData.potenciasContratadas?.[5] ?? contract.p6c ?? supplyPoint.p6c,
    p1p: contract.p1p ?? supplyPoint.p1p,
    p2p: contract.p2p ?? supplyPoint.p2p,
    p3p: contract.p3p ?? supplyPoint.p3p,
    p4p: contract.p4p ?? supplyPoint.p4p,
    p5p: contract.p5p ?? supplyPoint.p5p,
    p6p: contract.p6p ?? supplyPoint.p6p,
  };

  // Reglas 71 y 72: Sincronizar IBAN y CNAE del contrato activo hacia el SupplyPoint
  if (contract.iban && String(contract.iban).trim() !== '') {
    updateSpData.iban = String(contract.iban).trim();
  }
  const contractCnae = contractData?.cnae || contractData?.CNAE;
  if (contractCnae && /^\d{4}$/.test(String(contractCnae).trim())) {
    updateSpData.cnae = String(contractCnae).trim();
  }

  const modifiedTariff =
    typeof contractData?.tarifa === 'string'
      ? contractData.tarifa
      : Array.isArray(contractData?.Tarifa)
        ? contractData.Tarifa[0]
        : contractData?.Tarifa;

  if (parsedData.tarifaATR) {
    updateSpData.tariff = parsedData.tarifaATR;
  } else if (modifiedTariff) {
    updateSpData.tariff = modifiedTariff;
  } else if (contract.product?.tariff) {
    updateSpData.tariff = contract.product.tariff;
  }

  if (
    contractData?.isAutoconsumoModification ||
    contractData?.selfConsumptionType ||
    supplyPoint.selfConsumptionType ||
    parsedData.tipoAutoconsumo
  ) {
    updateSpData.hasSelfConsumption = true;
    if (parsedData.tipoAutoconsumo) updateSpData.selfConsumptionType = parsedData.tipoAutoconsumo;
    if (parsedData.cau) updateSpData.cau = parsedData.cau;
    if (parsedData.cauSubtype) updateSpData.cauSubtype = parsedData.cauSubtype;
    if (parsedData.cauCollective) updateSpData.cauCollective = parsedData.cauCollective;
    if (parsedData.cil) updateSpData.cil = parsedData.cil;
    if (parsedData.installedPowerGen !== undefined) updateSpData.installedPowerGen = parsedData.installedPowerGen;
    if (parsedData.installationType) updateSpData.installationType = parsedData.installationType;
    if (parsedData.meteringScheme) updateSpData.meteringScheme = parsedData.meteringScheme;
  }

  await prisma.supplyPoint.update({
    where: { id: supplyPoint.id },
    data: updateSpData,
  });
}

/**
 * Lógica pura de base de datos para procesar un XML de Switching.
 * Se separa para poder ser invocada desde el "Sweep" de reintentos.
 */
export async function processParsedSwitchingData(
  parsedData: ParsedSwitchingData,
  xmlUrl: string,
  existingEventId?: string
) {
  let contractId: string | undefined = undefined;
  let supplyPointId: string | undefined = undefined;
  let possibleSpIds: string[] = [];
  let tipoError: string | undefined = undefined;
  let warning: string | undefined = undefined;
  let extraObservacion: string | undefined = undefined;

  const uniqueProcess = buildSwitchingUniqueProcess(parsedData);

  // Primero intentamos encontrar el contrato exacto por nSolicitud si viene en el XML
  let foundContractBySolicitud: any = null;
  if (parsedData.codigoSolicitud && !['R1', 'Q1'].includes(parsedData.procesoBase)) {
    foundContractBySolicitud = await prisma.contract.findFirst({
      where: { nSolicitud: parsedData.codigoSolicitud },
      include: { supplyPoint: true, product: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
  }

  const cupsBase = parsedData.cups?.substring(0, 20);
  let supplyPoint: any = foundContractBySolicitud?.supplyPoint || null;

  if (cupsBase) {
    const matches = await prisma.supplyPoint.findMany({
      where: { cups: { startsWith: cupsBase } },
      include: {
        client: true,
        _count: { select: { contracts: true } },
      },
    });

    if (matches.length > 0) {
      possibleSpIds = matches.map(m => m.id);

      if (!supplyPoint) {
        if (parsedData.nifCliente) {
          const nifMatch = matches.find(m => m.client?.vatNumber?.toUpperCase() === parsedData.nifCliente);
          if (nifMatch) supplyPoint = nifMatch as any;
        }

        if (!supplyPoint) {
          matches.sort((a, b) => b._count.contracts - a._count.contracts);
          supplyPoint = matches[0] as any;
        }
      }
    }
  }

  if (supplyPoint && !possibleSpIds.includes(supplyPoint.id)) {
    possibleSpIds.push(supplyPoint.id);
  }

  if (!supplyPoint && cupsBase) {
    const leadMatch = await prisma.lead.findFirst({
      where: { cups: { startsWith: cupsBase } },
      include: { contract: { include: { supplyPoint: true } } },
    });
    if (leadMatch?.contract?.supplyPoint) {
      supplyPoint = leadMatch.contract.supplyPoint;
      if (!possibleSpIds.includes(supplyPoint.id)) possibleSpIds.push(supplyPoint.id);
    }
  }

  if (!supplyPoint) {
    if (parsedData.procesoBase === 'R1') {
      if (parsedData.paso === '09' && parsedData.estadoAR === 'ACEPTADO' && parsedData.codigoSolicitud) {
        await prisma.switchingEvent.updateMany({
          where: { procesoBase: 'R1', codigoSolicitud: parsedData.codigoSolicitud },
          data: { isAnnulled: true },
        });
      }
    } else if (parsedData.procesoBase !== 'Q1') {
      tipoError = 'CUPS_NO_ENCONTRADO';
      warning = 'No se ha encontrado este CUPS en la base de datos ni por número de solicitud.';
    }
  } else {
    supplyPointId = supplyPoint.id;
    const { paso, procesoBase } = parsedData;

    // ---------------------------------------------------------
    // 1. RECLAMACIONES R1 (aislado según Regla 114 / 125 / 190)
    // ---------------------------------------------------------
    if (procesoBase === 'R1') {
      const matchedContract =
        (await findHighestActiveContract(possibleSpIds)) ||
        (await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds } },
          include: { supplyPoint: true },
          orderBy: [{ activationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        }));

      if (matchedContract) {
        supplyPoint = matchedContract.supplyPoint;
        supplyPointId = matchedContract.supplyPointId;
        contractId = matchedContract.id;
      }

      if (paso === '09' && parsedData.estadoAR === 'ACEPTADO' && parsedData.codigoSolicitud) {
        await prisma.switchingEvent.updateMany({
          where: { procesoBase: 'R1', codigoSolicitud: parsedData.codigoSolicitud },
          data: { isAnnulled: true },
        });
      }
    }
    // ---------------------------------------------------------
    // 1b. EXPEDIENTE DE ANOMALÍA O FRAUDE (J1 — aislado antes de pasos genéricos 02/04/05)
    // ---------------------------------------------------------
    else if (procesoBase === 'J1') {
      const anyContract =
        (await findHighestActiveContract(possibleSpIds)) ||
        (await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds } },
          include: { supplyPoint: true },
          orderBy: [{ activationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        }));

      if (anyContract) {
        supplyPoint = anyContract.supplyPoint;
        supplyPointId = anyContract.supplyPointId;
        contractId = anyContract.id;
      }

      if (['01', '52'].includes(paso || '')) {
        tipoError = `J1_EXPEDIENTE_${paso}`;
        warning = `Expediente de Anomalía/Fraude (J1_${paso}) recibido${parsedData.observaciones ? `: ${parsedData.observaciones}` : '. Revisar XML.'}`;
      } else {
        extraObservacion = `Comunicación de expediente J1 (paso ${paso || 'N/A'}) registrada.`;
      }
    }
    // ---------------------------------------------------------
    // 2. SOLICITUDES Y RESPUESTAS DE ANULACIÓN (A3_06/07, M1_06/07, C1_08/09, C2_08/09, B1_03/04, E1_03/04, E2_08/09)
    // ---------------------------------------------------------
    else if (parsedData.isAnulacionSolicitud) {
      const targetContract =
        foundContractBySolicitud ||
        (await prisma.contract.findFirst({
          where: {
            supplyPointId: { in: possibleSpIds },
            status: { in: [...TRAMITANDO_STATUSES, ...ACTIVE_STATUSES] },
          },
          include: { supplyPoint: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        }));
      if (targetContract) {
        supplyPoint = targetContract.supplyPoint;
        supplyPointId = targetContract.supplyPointId;
        contractId = targetContract.id;
      }
      extraObservacion = `Solicitud de anulación (${procesoBase}_${paso}) registrada.`;
    } else if (parsedData.isAnulacionAceptada) {
      if (['B1', 'E1'].includes(procesoBase)) {
        const activeContract = foundContractBySolicitud || (await findHighestActiveContract(possibleSpIds));
        if (activeContract) {
          supplyPoint = activeContract.supplyPoint;
          supplyPointId = activeContract.supplyPointId;
          contractId = activeContract.id;
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: {
              suspendido: false,
              bajaProcess: null,
              fechaPrevistaBaja: null,
              fechaAceptacionBaja: null,
              internalComments: `[Anulación ${procesoBase}_${paso}] Baja/desistimiento anulado con éxito.\n${activeContract.internalComments || ''}`,
            },
          });
        }
      } else {
        const tramitandoContract =
          foundContractBySolicitud ||
          (await prisma.contract.findFirst({
            where: { supplyPointId: { in: possibleSpIds }, status: { in: TRAMITANDO_STATUSES } },
            include: { supplyPoint: true },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          }));
        if (tramitandoContract) {
          supplyPoint = tramitandoContract.supplyPoint;
          supplyPointId = tramitandoContract.supplyPointId;
          contractId = tramitandoContract.id;
          await prisma.contract.update({
            where: { id: tramitandoContract.id },
            data: {
              status: 'ANULADO',
              internalComments: `[Anulación ${procesoBase}_${paso}] Solicitud anulada por aceptación de distribuidora.\n${tramitandoContract.internalComments || ''}`,
            },
          });
        }
      }
      if (parsedData.codigoSolicitud) {
        await prisma.switchingEvent.updateMany({
          where: { procesoBase, codigoSolicitud: parsedData.codigoSolicitud },
          data: { isAnnulled: true },
        });
      }
      extraObservacion = `Aceptación de anulación (${procesoBase}_${paso}) procesada.`;
    }
    // ---------------------------------------------------------
    // 3. INCIDENCIAS ATR EN CAMPO (Paso 03 en A3, C1, C2, M1)
    // ---------------------------------------------------------
    else if (parsedData.esIncidencia) {
      const tramitandoContract =
        foundContractBySolicitud ||
        (await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { in: TRAMITANDO_STATUSES } },
          include: { supplyPoint: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        }));
      if (tramitandoContract) {
        supplyPoint = tramitandoContract.supplyPoint;
        supplyPointId = tramitandoContract.supplyPointId;
        contractId = tramitandoContract.id;
        await prisma.contract.update({
          where: { id: tramitandoContract.id },
          data: {
            ...(parsedData.fechaPrevActivacion && { fechaPrevistaActivacion: parsedData.fechaPrevActivacion }),
            internalComments: `[Incidencia ATR ${procesoBase}_03] ${parsedData.observaciones || 'Revisar XML'}\n${tramitandoContract.internalComments || ''}`,
          },
        });
      }
      tipoError = 'INCIDENCIA_ATR_CAMPO';
      warning = `Incidencia en actuación de campo (${procesoBase}_03): ${parsedData.observaciones || 'Revisar motivo en XML.'}`;
    }
    // ---------------------------------------------------------
    // 4. CAMBIOS SALIENTES C1 / C2 (Pasos 06, 11, 10)
    // ---------------------------------------------------------
    else if (paso === '06' && ['C1', 'C2'].includes(procesoBase)) {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        if (!parsedData.fechaActivacionBaja) {
          tipoError = 'SIN_FECHA_BAJA';
          warning = `El XML ${procesoBase}_06 no contiene fecha de activación de baja válida. Revisar manualmente.`;
        } else if (!activeContract.fechaPrevistaBaja) {
          tipoError = 'ESPERANDO_PASO_11';
          warning = 'Se recibió un paso 06 (Baja), pero el contrato no tiene fecha prevista de baja. Se pospone hasta recibir el paso 11.';
        } else if (activeContract.terminationDate) {
          tipoError = 'COLISION_DE_FECHAS';
          warning = 'El XML trae una fecha de baja, pero el contrato ya tiene fecha de fin. Se ha cancelado la sobreescritura.';
        } else {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: {
              terminationDate: parsedData.fechaActivacionBaja,
              status: 'FINALIZADO',
              bajaProcess: procesoBase,
            },
          });
          await cancelSubsequentAndOrphanContracts(activeContract, possibleSpIds, `${procesoBase}_06`);
        }
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = 'Se recibió un paso 06 (Baja), pero no se encontró un contrato ACTIVO para este CUPS.';
      }
    } else if (paso === '11' && ['C1', 'C2'].includes(procesoBase)) {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        if (!parsedData.fechaActivacionBaja) {
          tipoError = 'SIN_FECHA_PREVISTA_BAJA';
          warning = `El XML ${procesoBase}_11 no contiene fecha prevista de baja válida. Revisar manualmente.`;
        } else if (activeContract.fechaPrevistaBaja) {
          tipoError = 'COLISION_DE_FECHAS';
          warning = 'El XML trae un aviso de baja, pero el contrato ya tiene fecha prevista de baja. Se ha cancelado la sobreescritura.';
        } else {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { fechaPrevistaBaja: parsedData.fechaActivacionBaja },
          });
        }
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = 'Se recibió un paso 11 (Aviso baja), pero no se encontró un contrato ACTIVO para este CUPS.';
      }
    } else if (paso === '10' && ['C1', 'C2'].includes(procesoBase)) {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        if (activeContract.fechaPrevistaBaja) {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: { fechaPrevistaBaja: null },
          });
        }
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = 'Se recibió un paso 10 (Anulación de cambio), pero no se encontró un contrato ACTIVO para este CUPS.';
      }
    }
    // ---------------------------------------------------------
    // 5. ACTIVACIÓN DE BAJAS / SUSPENSIONES (B1, B2, E1 Paso 05)
    // ---------------------------------------------------------
    else if ((procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E1') && paso === '05') {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;

        const bajaDate = parsedData.fechaActivacionBaja || parsedData.fechaActivacionAlta;
        if (!bajaDate) {
          tipoError = 'SIN_FECHA_BAJA';
          warning = `El XML de activación de baja (${procesoBase}_05) no contiene una fecha válida. Revisar manualmente.`;
        } else {
          // Distinguir en B1 si la solicitud original era Motivo '03' (Suspensión/Corte temporal por impago, Tabla 10)
          let isTemporarySuspension = procesoBase === 'B1' && parsedData.motivoBaja === '03';
          if (procesoBase === 'B1' && !parsedData.motivoBaja && parsedData.codigoSolicitud) {
            const b1Sol = await prisma.switchingEvent.findFirst({
              where: { procesoBase: 'B1', paso: '01', codigoSolicitud: parsedData.codigoSolicitud },
              select: { observaciones: true },
            });
            if (b1Sol?.observaciones?.includes('MOTIVO_03')) {
              isTemporarySuspension = true;
            }
          }

          if (isTemporarySuspension) {
            await prisma.contract.update({
              where: { id: activeContract.id },
              data: {
                suspendido: true,
                bajaProcess: 'B1',
                internalComments: `[Corte por Impago B1_05] Suministro suspendido temporalmente con fecha ${bajaDate.toISOString().split('T')[0]}.\n${activeContract.internalComments || ''}`,
              },
            });
            extraObservacion = `Suspensión temporal por impago (B1_05 motivo 03) aplicada con fecha ${bajaDate.toISOString().split('T')[0]}.`;
          } else {
            await prisma.contract.update({
              where: { id: activeContract.id },
              data: {
                status: 'FINALIZADO',
                terminationDate: bajaDate,
                bajaProcess: procesoBase,
              },
            });
            await cancelSubsequentAndOrphanContracts(activeContract, possibleSpIds, `${procesoBase}_05`);
          }
        }
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = `Se recibió Activación (05) de proceso ${procesoBase}, pero no se encontró un contrato ACTIVO para este CUPS.`;
      }
    }
    // ---------------------------------------------------------
    // 6. MODIFICACIÓN UNILATERAL DISTRIBUIDORA (M2 Paso 05)
    // ---------------------------------------------------------
    else if (procesoBase === 'M2' && paso === '05') {
      if (!parsedData.fechaActivacionAlta) {
        tipoError = 'SIN_FECHA_ACTIVACION';
        warning = 'El XML de M2_05 no contiene una fecha de activación válida. Revisar manualmente.';
      } else {
        const activeContract = await findHighestActiveContract(possibleSpIds);
        if (activeContract) {
          supplyPoint = activeContract.supplyPoint;
          supplyPointId = supplyPoint.id;
          contractId = activeContract.id;

          const { createUnilateralModificationAction } = await import('@/app/actions/contractModification');
          const modRes = await createUnilateralModificationAction(activeContract.id, parsedData);
          if (modRes.error) {
            tipoError = 'ERROR_MODIFICACION_UNILATERAL';
            warning = `Error al procesar la modificación M2: ${modRes.error}`;
          } else {
            contractId = modRes.newContractId;
          }
        } else {
          tipoError = 'CONTRATO_NO_ACTIVO';
          warning = 'Se recibió un paso 05 de M2 (Mod. Unilateral), pero no se encontró un contrato ACTIVO para este CUPS.';
        }
      }
    }
    // ---------------------------------------------------------
    // 7. ACTIVACIÓN DE ALTAS / CAMBIOS / MODIFICACIONES / REPOSICIONES (Paso 05)
    // ---------------------------------------------------------
    else if (paso === '05' && procesoBase !== 'R1') {
      const tramitandoContract =
        (foundContractBySolicitud && TRAMITANDO_STATUSES.includes(foundContractBySolicitud.status)
          ? foundContractBySolicitud
          : null) ||
        (await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { in: TRAMITANDO_STATUSES } },
          include: { supplyPoint: true, product: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        }));

      if (tramitandoContract) {
        supplyPoint = tramitandoContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = tramitandoContract.id;

        if (!parsedData.fechaActivacionAlta) {
          tipoError = 'SIN_FECHA_ACTIVACION';
          warning = `El XML de activación (${procesoBase}_05) no contiene una fecha de activación válida. Revisar manualmente.`;
        } else if (!tramitandoContract.fechaPrevistaActivacion && procesoBase !== 'E2') {
          tipoError = 'ESPERANDO_PASO_02';
          warning = 'Se recibió un paso 05 (Alta), pero el contrato no tiene fecha prevista de alta. Se pospone hasta recibir el paso 02.';
        } else if (tramitandoContract.activationDate) {
          tipoError = 'COLISION_DE_FECHAS';
          warning = 'El XML trae una fecha de activación, pero el contrato ya tiene una fecha de alta asignada.';
        } else {
          const isA3C1C2 = ['A3', 'C1', 'C2'].includes(procesoBase);
          await prisma.contract.update({
            where: { id: tramitandoContract.id },
            data: {
              activationDate: parsedData.fechaActivacionAlta,
              status: 'ACTIVO',
              suspendido: false,
              ...(isA3C1C2 && { permanenceStartDate: parsedData.fechaActivacionAlta }),
            },
          });

          await syncContractDataToSupplyPoint(supplyPoint, tramitandoContract, parsedData);

          if (isA3C1C2) {
            const { calculateAndSnapshotContractCommission } = await import('@/lib/services/CommissionEngine');
            await calculateAndSnapshotContractCommission(tramitandoContract.id, { onlyIfEmpty: true }).catch((err) =>
              console.warn('Auto-cálculo de comisión omitido en switchingIngest:', err)
            );
          }

          // Regla M1: Rescindir contrato anterior activo un día antes
          if (procesoBase === 'M1') {
            const oldActiveContract = await prisma.contract.findFirst({
              where: {
                supplyPointId: { in: possibleSpIds },
                status: { in: ACTIVE_STATUSES },
                id: { not: tramitandoContract.id },
              },
              orderBy: [{ version: 'desc' }, { activationDate: 'desc' }],
            });
            if (oldActiveContract && !oldActiveContract.terminationDate) {
              const prevDate = new Date(parsedData.fechaActivacionAlta);
              prevDate.setDate(prevDate.getDate() - 1);
              await prisma.contract.update({
                where: { id: oldActiveContract.id },
                data: { terminationDate: prevDate, status: 'FINALIZADO' },
              });
            }
          }
        }
      } else if (procesoBase === 'E2') {
        if (!parsedData.fechaActivacionAlta) {
          tipoError = 'SIN_FECHA_ACTIVACION';
          warning = 'Se recibió E2_05 sin contrato TRAMITANDO y sin Fecha de Activación válida en el XML.';
        } else {
          const lastContract = await prisma.contract.findFirst({
            where: {
              supplyPointId: { in: possibleSpIds },
              status: { notIn: ['BORRADOR', 'Borrador', 'RECHAZADO', 'Rechazado', 'RECHAZO_DISTRIBUIDORA', 'Rechazo Distribuidora'] },
            },
            include: { product: true },
            orderBy: [{ terminationDate: 'desc' }, { version: 'desc' }],
          });

          if (lastContract) {
            const {
              id,
              createdAt,
              updatedAt,
              airtableId,
              previousContractId,
              docusignEnvelopeId,
              product,
              ...cloneData
            } = lastContract;

            const maxVersionContract = lastContract.contractCode
              ? await prisma.contract.findFirst({
                  where: { contractCode: lastContract.contractCode, brandId: lastContract.brandId },
                  orderBy: { version: 'desc' },
                })
              : null;
            const nextVersion = maxVersionContract ? maxVersionContract.version + 1 : lastContract.version + 1;

            const newContract = await prisma.contract.create({
              data: {
                ...(cloneData as any),
                version: nextVersion,
                status: 'ACTIVO',
                suspendido: false,
                bajaProcess: null,
                activationDate: parsedData.fechaActivacionAlta,
                terminationDate: null,
                previousContractId: lastContract.id,
              },
            });
            contractId = newContract.id;
            await syncContractDataToSupplyPoint(supplyPoint, { ...newContract, product }, parsedData);
            extraObservacion = 'Activada Reposición (E2_05). Se ha clonado el último contrato y puesto en ACTIVO.';
          } else {
            tipoError = 'CONTRATO_NO_ENCONTRADO_PARA_CLONAR';
            warning = 'Se recibió un paso 05 de E2 inesperado, pero no se encontró un contrato previo para clonar.';
          }
        }
      } else {
        tipoError = 'CONTRATO_NO_TRAMITANDO';
        warning = 'Se recibió un paso 05 (Alta), pero no se encontró un contrato TRAMITANDO para este CUPS.';
      }
    }
    // ---------------------------------------------------------
    // 8. ACEPTACIÓN / RECHAZO DE BAJA O DESISTIMIENTO (B1, B2, E1 Paso 02 y E1 Paso 04)
    // ---------------------------------------------------------
    else if ((procesoBase === 'B1' || procesoBase === 'B2' || procesoBase === 'E1') && paso === '02') {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        if (parsedData.estadoAR === 'ACEPTADO') {
          if (!parsedData.fechaAR) {
            tipoError = 'SIN_FECHA_AR';
            warning = `El XML ${procesoBase}_02 (Aceptación) no contiene FechaAceptacion válida. Revisar manualmente.`;
          } else {
            const updateData: any = {};
            if (procesoBase === 'B1' || procesoBase === 'E1') {
              updateData.suspendido = true;
              updateData.bajaProcess = procesoBase;
              updateData.fechaAceptacionBaja = parsedData.fechaAR;
              if (parsedData.fechaPrevActivacion) {
                updateData.fechaPrevistaBaja = parsedData.fechaPrevActivacion;
              }
            }
            await prisma.contract.update({
              where: { id: activeContract.id },
              data: updateData,
            });
          }
        } else if (parsedData.estadoAR === 'RECHAZADO') {
          await prisma.contract.update({
            where: { id: activeContract.id },
            data: {
              internalComments: parsedData.observaciones
                ? `[Rechazo ${procesoBase}] ${parsedData.observaciones}\n${activeContract.internalComments || ''}`
                : activeContract.internalComments,
            },
          });
          tipoError = `${procesoBase}_RECHAZADO`;
          warning = `Rechazo recibido en ${procesoBase}_02: ${parsedData.observaciones || 'Revisar motivo en XML.'}`;
        }
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = `Se recibió Aceptación/Rechazo de proceso ${procesoBase}, pero no se encontró un contrato ACTIVO para este CUPS.`;
      }
    } else if (procesoBase === 'E1' && paso === '04') {
      const contract = await prisma.contract.findFirst({
        where: {
          supplyPointId: { in: possibleSpIds },
          status: { in: [...ACTIVE_STATUSES, 'FINALIZADO', 'Finalizado'] },
        },
        include: { supplyPoint: true },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      });
      if (contract) {
        supplyPointId = contract.supplyPointId;
        contractId = contract.id;
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            internalComments: parsedData.observaciones
              ? `[Rechazo E1] ${parsedData.observaciones}\n${contract.internalComments || ''}`
              : contract.internalComments,
          },
        });
        tipoError = 'E1_RECHAZADO';
        warning = `Rechazo de Desistimiento (E1_04) recibido: ${parsedData.observaciones || 'Revisar comentarios internos.'}`;
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO_NI_FINALIZADO';
        warning = 'Se recibió un Rechazo de Desistimiento (E1_04), pero no se encontró un contrato ACTIVO o FINALIZADO.';
      }
    }
    // ---------------------------------------------------------
    // 9. ACEPTACIÓN / RECHAZO DE CONTRATACIÓN (Pasos 02 y 04 en A3, C1, C2, M1, E2, D1, P0)
    // ---------------------------------------------------------
    else if (procesoBase === 'D1' && paso === '02') {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = activeContract.supplyPointId;
        contractId = activeContract.id;
      }
      extraObservacion = 'Rechazo de notificación D1 (D1_02) enviado a distribuidora.';
    } else if ((paso === '02' || paso === '04') && procesoBase !== 'R1') {
      const tramitandoContract =
        (foundContractBySolicitud && TRAMITANDO_STATUSES.includes(foundContractBySolicitud.status)
          ? foundContractBySolicitud
          : null) ||
        (await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { in: TRAMITANDO_STATUSES } },
          include: { supplyPoint: true, product: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        }));

      if (tramitandoContract) {
        supplyPoint = tramitandoContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = tramitandoContract.id;

        if (parsedData.estadoAR === 'ACEPTADO') {
          const contractData = (tramitandoContract.airtableData as any) || {};
          const isModificacionAdministrativa =
            tramitandoContract.tipoC2 === 'S' ||
            tramitandoContract.tipoC2 === 'M1_S' ||
            tramitandoContract.tipo === 'M1-S' ||
            contractData?.tipoC2 === 'S' ||
            contractData?.tipoSolicitudAdministrativa === 'S' ||
            contractData?.tipoSolicitudAdministrativa === 'A' ||
            contractData?.tipoSolicitudAdministrativa === 'C' ||
            contractData?.isSubrogation === true;

          const isTraspaso = contractData?.tipoSolicitudAdministrativa === 'T';
          const isAutoconsumo =
            contractData?.isAutoconsumoModification === true ||
            tramitandoContract.tramitationType?.toLowerCase().includes('autoconsumo');

          const isAutoActivatableAdmin =
            procesoBase === 'M1' &&
            isModificacionAdministrativa &&
            !isTraspaso &&
            !isAutoconsumo &&
            parsedData.actuacionCampo !== true;

          if (tramitandoContract.fechaAceptacion && !isAutoActivatableAdmin) {
            tipoError = 'COLISION_DE_FECHAS';
            warning = 'El XML trae una fecha de aceptación, pero el contrato ya tiene fecha de aceptación asignada.';
          } else if (!parsedData.fechaAR && !(isAutoActivatableAdmin && tramitandoContract.fechaAceptacion)) {
            tipoError = 'SIN_FECHA_AR';
            warning = `El XML ${procesoBase}_02 (Aceptación) no contiene FechaAceptacion válida. Revisar manualmente.`;
          } else {
            const activationDate =
              parsedData.fechaPrevActivacion ||
              parsedData.fechaAR ||
              tramitandoContract.fechaPrevistaActivacion ||
              tramitandoContract.fechaAceptacion;

            await prisma.contract.update({
              where: { id: tramitandoContract.id },
              data: {
                fechaAceptacion: parsedData.fechaAR || tramitandoContract.fechaAceptacion,
                fechaPrevistaActivacion: parsedData.fechaPrevActivacion || tramitandoContract.fechaPrevistaActivacion,
                ...(isAutoActivatableAdmin
                  ? {
                      status: 'ACTIVO',
                      activationDate,
                    }
                  : {}),
              },
            });

            if (isAutoActivatableAdmin && activationDate) {
              // Reglas 71 y 72: sincronizar IBAN y datos maestros al SupplyPoint en auto-activación M1 administrativo
              await syncContractDataToSupplyPoint(supplyPoint, tramitandoContract, parsedData);

              const oldActiveContract = await prisma.contract.findFirst({
                where: {
                  supplyPointId: { in: possibleSpIds },
                  status: { in: ACTIVE_STATUSES },
                  id: { not: tramitandoContract.id },
                },
                orderBy: [{ version: 'desc' }, { activationDate: 'desc' }],
              });
              if (oldActiveContract && !oldActiveContract.terminationDate) {
                const prevDate = new Date(activationDate);
                prevDate.setDate(prevDate.getDate() - 1);
                await prisma.contract.update({
                  where: { id: oldActiveContract.id },
                  data: { terminationDate: prevDate, status: 'FINALIZADO' },
                });
              }
              extraObservacion = 'Activado automáticamente por ser modificación administrativa sin trabajos de campo.';
            }
          }
        } else if (parsedData.estadoAR === 'RECHAZADO') {
          const rejectedStatuses = ['RECHAZADO', 'Rechazado', 'RECHAZO_DISTRIBUIDORA', 'Rechazo Distribuidora'];
          if (rejectedStatuses.includes(tramitandoContract.status)) {
            tipoError = 'COLISION_DE_ESTADO';
            warning = 'El contrato ya estaba marcado como RECHAZO_DISTRIBUIDORA / RECHAZADO.';
          } else {
            await prisma.contract.update({
              where: { id: tramitandoContract.id },
              data: {
                status: 'RECHAZO_DISTRIBUIDORA',
                fechaRechazo: parsedData.fechaAR ?? null,
                internalComments: parsedData.observaciones
                  ? `[Rechazo ${procesoBase}] ${parsedData.observaciones}\n${tramitandoContract.internalComments || ''}`
                  : tramitandoContract.internalComments,
              },
            });
          }
        }
      } else if (procesoBase === 'E2') {
        const lastContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds } },
          include: { supplyPoint: true },
          orderBy: [{ terminationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        });
        if (lastContract) {
          supplyPoint = lastContract.supplyPoint;
          supplyPointId = lastContract.supplyPointId;
          contractId = lastContract.id;
        }
        if (parsedData.estadoAR === 'RECHAZADO') {
          tipoError = 'E2_RECHAZADO';
          warning = `Rechazo de Reposición (E2_${paso}): ${parsedData.observaciones || 'Revisar motivo en XML.'}`;
        } else {
          extraObservacion = `Aceptación de Reposición (E2_${paso}) recibida; pendiente de activación efectiva en E2_05.`;
        }
      } else {
        tipoError = 'CONTRATO_NO_TRAMITANDO';
        warning = 'Se recibió Aceptación/Rechazo, pero no se encontró un contrato TRAMITANDO para este CUPS.';
      }
    }
    // ---------------------------------------------------------
    // 10. SOLICITUD DE CONTRATACIÓN PASO 01 (A3, C1, C2, M1, E2)
    // ---------------------------------------------------------
    else if (paso === '01' && ['A3', 'C1', 'C2', 'M1', 'E2'].includes(procesoBase)) {
      const acceptedContract =
        (foundContractBySolicitud &&
        ['ACEPTADO', 'Aceptado', 'RECHAZADO', 'Rechazado', 'RECHAZO_DISTRIBUIDORA', 'Rechazo Distribuidora', 'BORRADOR', 'Borrador'].includes(
          foundContractBySolicitud.status
        )
          ? foundContractBySolicitud
          : null) ||
        (await prisma.contract.findFirst({
          where: {
            supplyPointId: { in: possibleSpIds },
            status: {
              in: ['ACEPTADO', 'Aceptado', 'RECHAZADO', 'Rechazado', 'RECHAZO_DISTRIBUIDORA', 'Rechazo Distribuidora', 'BORRADOR', 'Borrador'],
            },
          },
          include: { supplyPoint: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        }));

      if (acceptedContract) {
        supplyPoint = acceptedContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = acceptedContract.id;

        await prisma.contract.update({
          where: { id: acceptedContract.id },
          data: {
            status: 'TRAMITANDO',
            nSolicitud: parsedData.codigoSolicitud || acceptedContract.nSolicitud,
          },
        });
      } else if (foundContractBySolicitud && TRAMITANDO_STATUSES.includes(foundContractBySolicitud.status)) {
        supplyPoint = foundContractBySolicitud.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = foundContractBySolicitud.id;
      } else if (procesoBase === 'E2') {
        const lastContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds } },
          include: { supplyPoint: true },
          orderBy: [{ terminationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        });
        if (lastContract) {
          supplyPoint = lastContract.supplyPoint;
          supplyPointId = lastContract.supplyPointId;
          contractId = lastContract.id;
        }
        extraObservacion = 'Solicitud de Reposición (E2_01) registrada.';
      } else {
        const anyContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
          include: { supplyPoint: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        });
        if (anyContract) {
          supplyPoint = anyContract.supplyPoint;
          supplyPointId = supplyPoint.id;
          contractId = anyContract.id;
        }
        tipoError = 'CONTRATO_NO_ACEPTADO_O_RECHAZADO';
        warning = `Se recibió un paso 01 (${procesoBase}), pero no se encontró un contrato en estado ACEPTADO o RECHAZADO para pasarlo a TRAMITANDO.`;
      }
    }
    // ---------------------------------------------------------
    // 11. SOLICITUD DE BAJA B1 PASO 01
    // ---------------------------------------------------------
    else if (procesoBase === 'B1' && paso === '01') {
      const activeContract = foundContractBySolicitud || (await findHighestActiveContract(possibleSpIds));
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = activeContract.supplyPointId;
        contractId = activeContract.id;
      }
      if (parsedData.motivoBaja) {
        extraObservacion = `MOTIVO_${parsedData.motivoBaja}`;
      }
    }
    // ---------------------------------------------------------
    // 12. PROCESO D1 (Notificaciones de cambios desde distribuidora: 01 y 10)
    // ---------------------------------------------------------
    else if (procesoBase === 'D1' && paso === '01') {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;

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
            data: updateData,
          });
        }

        tipoError = 'D1_NOTIFICACION_REVISION';
        warning = 'Notificación D1 recibida (ej. Autoconsumo). Revisar y decidir si enviar rechazo (D1_02) antes de 10 días hábiles.';
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = 'Se recibió un paso 01 de D1 (Notificación), pero no se encontró un contrato ACTIVO para este CUPS.';
      }
    } else if (procesoBase === 'D1' && paso === '10') {
      const anyContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds } },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      });
      if (anyContract) {
        supplyPointId = anyContract.supplyPointId;
        contractId = anyContract.id;
      }
      if (parsedData.codigoSolicitud) {
        await prisma.switchingEvent.updateMany({
          where: { procesoBase: 'D1', codigoSolicitud: parsedData.codigoSolicitud },
          data: { isAnnulled: true, isResolved: true },
        });
      }
      extraObservacion = 'Notificación D1 anulada por la distribuidora (D1_10).';
    }
    // ---------------------------------------------------------
    // 13. DESISTIMIENTOS E1 (01, 11, 06, 03/13, 08/09/10)
    // ---------------------------------------------------------
    else if (procesoBase === 'E1' && paso === '01') {
      const activeContract = await findHighestActiveContract(possibleSpIds);
      if (activeContract) {
        supplyPoint = activeContract.supplyPoint;
        supplyPointId = supplyPoint.id;
        contractId = activeContract.id;
        await prisma.contract.update({
          where: { id: activeContract.id },
          data: {
            internalComments: `[Aviso] Se ha enviado solicitud de Desistimiento (E1) a la distribuidora.\n${activeContract.internalComments || ''}`,
          },
        });
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = 'Se envió un Desistimiento (E1_01), pero no se encontró un contrato ACTIVO para este CUPS.';
      }
    } else if (procesoBase === 'E1' && paso === '11') {
      if (!parsedData.fechaPrevActivacion) {
        tipoError = 'SIN_FECHA_PREVISTA';
        warning = 'El XML de E1_11 no contiene una FechaPrevistaActivacion válida. Revisar manualmente.';
      } else {
        const lastFinalizedContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { in: ['FINALIZADO', 'Finalizado'] } },
          orderBy: [{ terminationDate: 'desc' }, { version: 'desc' }],
        });
        if (lastFinalizedContract) {
          supplyPointId = lastFinalizedContract.supplyPointId;
          const {
            id,
            createdAt,
            updatedAt,
            airtableId,
            previousContractId,
            docusignEnvelopeId,
            terminationDate,
            ...cloneData
          } = lastFinalizedContract;

          const maxVersionContract = lastFinalizedContract.contractCode
            ? await prisma.contract.findFirst({
                where: { contractCode: lastFinalizedContract.contractCode, brandId: lastFinalizedContract.brandId },
                orderBy: { version: 'desc' },
              })
            : null;
          const newVersion = maxVersionContract
            ? (maxVersionContract.version || 0) + 1
            : (lastFinalizedContract.version || 0) + 1;

          const newContract = await prisma.contract.create({
            data: {
              ...(cloneData as any),
              status: 'TRAMITANDO',
              version: newVersion,
              previousContractId: lastFinalizedContract.id,
              fechaPrevistaActivacion: parsedData.fechaPrevActivacion,
              internalComments: `[Aviso] Contrato clonado automáticamente por E1_11 (Aceptación de desistimiento para recuperar cliente).\n${lastFinalizedContract.internalComments || ''}`,
            },
          });
          contractId = newContract.id;
          extraObservacion = 'Aceptación de Desistimiento (E1_11) procesada: contrato clonado y puesto en TRAMITANDO.';
        } else {
          tipoError = 'CONTRATO_FINALIZADO_NO_ENCONTRADO';
          warning = 'Se recibió un E1_11, pero no se encontró un contrato FINALIZADO para clonar.';
        }
      }
    } else if (procesoBase === 'E1' && paso === '06') {
      const altaDate = parsedData.fechaActivacionAlta || parsedData.fechaActivacionBaja;
      if (!altaDate) {
        tipoError = 'SIN_FECHA_ACTIVACION';
        warning = 'El XML de E1_06 no contiene fecha de activación válida. Revisar manualmente.';
      } else {
        const tramitandoContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds }, status: { in: TRAMITANDO_STATUSES } },
          include: { supplyPoint: true, product: true },
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        });
        if (tramitandoContract) {
          supplyPoint = tramitandoContract.supplyPoint;
          supplyPointId = tramitandoContract.supplyPointId;
          await prisma.contract.update({
            where: { id: tramitandoContract.id },
            data: {
              status: 'ACTIVO',
              suspendido: false,
              bajaProcess: null,
              activationDate: altaDate,
              internalComments: `[Aviso] Activación por Desistimiento (E1_06). Cliente recuperado con fecha ${altaDate.toISOString().split('T')[0]}.\n${tramitandoContract.internalComments || ''}`,
            },
          });
          await syncContractDataToSupplyPoint(supplyPoint, tramitandoContract, parsedData);
          contractId = tramitandoContract.id;
          extraObservacion = `Activación por Desistimiento (E1_06) completada con fecha ${altaDate.toISOString().split('T')[0]}.`;
        } else {
          tipoError = 'CONTRATO_TRAMITANDO_NO_ENCONTRADO';
          warning = 'Se recibió un E1_06, pero no se encontró el contrato TRAMITANDO previo (E1_11).';
        }
      }
    } else if (procesoBase === 'E1' && ['03', '13'].includes(paso!)) {
      const contract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds }, status: { notIn: ['FINALIZADO', 'Finalizado'] } },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
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
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      });
      if (contract) {
        supplyPointId = contract.supplyPointId;
        contractId = contract.id;
        if (TRAMITANDO_STATUSES.includes(contract.status)) {
          await prisma.contract.update({
            where: { id: contract.id },
            data: {
              status: 'RECHAZADO',
              internalComments: `[Aviso] El proceso de recuperación por desistimiento ha sido ANULADO (paso ${paso}).\n${contract.internalComments || ''}`,
            },
          });
        } else if (contract.suspendido) {
          await prisma.contract.update({
            where: { id: contract.id },
            data: {
              suspendido: false,
              bajaProcess: null,
              internalComments: `[Aviso] El proceso de desistimiento ha sido ANULADO (paso ${paso}). Se levanta la suspensión.\n${contract.internalComments || ''}`,
            },
          });
        }
      }
      extraObservacion = `Anulación de proceso de Desistimiento (paso ${paso}) procesada.`;
    }
    // ---------------------------------------------------------
    // 14. REPOSICIONES E2 (06 pérdida suministro, 14 consulta, 15 respuesta, 12 rechazo)
    // ---------------------------------------------------------
    else if (procesoBase === 'E2' && paso !== '05' && paso !== '02' && paso !== '04') {
      if (paso === '06') {
        const activeContract = await findHighestActiveContract(possibleSpIds);
        const bajaDate = parsedData.fechaActivacionBaja || parsedData.fechaActivacionAlta;
        if (activeContract) {
          supplyPoint = activeContract.supplyPoint;
          supplyPointId = activeContract.supplyPointId;
          contractId = activeContract.id;
          if (!bajaDate) {
            tipoError = 'SIN_FECHA_BAJA';
            warning = 'Se recibió E2_06 (Baja por reposición), pero el XML no contiene fecha de activación válida. Revisar manualmente.';
          } else {
            await prisma.contract.update({
              where: { id: activeContract.id },
              data: {
                status: 'FINALIZADO',
                terminationDate: bajaDate,
                bajaProcess: 'E2',
                internalComments: `[Baja E2_06] Suministro perdido por activación de reposición con fecha ${bajaDate.toISOString().split('T')[0]}.\n${activeContract.internalComments || ''}`,
              },
            });
            await cancelSubsequentAndOrphanContracts(activeContract, possibleSpIds, 'E2_06');
            tipoError = 'E2_NOTIFICACION_BAJA';
            warning = `Notificación de Baja por Reposición (E2_06) ejecutada con fecha ${bajaDate.toISOString().split('T')[0]}. Revisar expediente.`;
          }
        } else {
          tipoError = 'CONTRATO_NO_ACTIVO';
          warning = 'Se recibió E2_06 (Baja por reposición), pero no había ningún contrato ACTIVO en este CUPS.';
        }
      } else {
        const anyContract = await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds } },
          include: { supplyPoint: true },
          orderBy: [{ activationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        });
        if (anyContract) {
          supplyPoint = anyContract.supplyPoint;
          supplyPointId = anyContract.supplyPointId;
          contractId = anyContract.id;
        }

        if (paso === '14') {
          tipoError = 'E2_CONSULTA_REPOSICION';
          warning = 'Consulta de Reposición (E2_14) recibida. Se debe Aceptar o Rechazar (paso 15) desde Distribuidoras > Reposiciones.';
        } else if (paso === '15') {
          extraObservacion = `Respuesta a consulta de reposición (E2_15: ${parsedData.estadoAR || 'ENVIADA'}) registrada.`;
        } else if (paso === '12') {
          if (anyContract && TRAMITANDO_STATUSES.includes(anyContract.status)) {
            await prisma.contract.update({
              where: { id: anyContract.id },
              data: {
                status: 'RECHAZO_DISTRIBUIDORA',
                fechaRechazo: parsedData.fechaAR ?? null,
                internalComments: `[Rechazo E2_12] ${parsedData.observaciones || 'Reposición rechazada'}\n${anyContract.internalComments || ''}`,
              },
            });
          }
          tipoError = 'E2_RECHAZADO';
          warning = `Reposición rechazada (E2_12): ${parsedData.observaciones || 'Revisar XML.'}`;
        } else {
          tipoError = `E2_PASO_${paso}`;
          warning = `Aviso de Reposición (paso ${paso}) recibido y pendiente de revisión.`;
        }
      }
    }
    // ---------------------------------------------------------
    // 15. TRASPASO A LA COR (T1) — Cero fallback a new Date()
    // ---------------------------------------------------------
    else if (procesoBase === 'T1') {
      const contract = await findHighestActiveContract(possibleSpIds);

      if (contract) {
        supplyPointId = contract.supplyPointId;
        contractId = contract.id;

        if (paso === '06') {
          const bajaDate = parsedData.fechaActivacionBaja || parsedData.fechaActivacionAlta;
          if (!bajaDate) {
            tipoError = 'SIN_FECHA_BAJA';
            warning = 'El XML de T1_06 no contiene FechaActivacion válida. No se ha modificado el contrato; revisar manualmente.';
          } else {
            await prisma.contract.update({
              where: { id: contract.id },
              data: {
                status: 'FINALIZADO',
                terminationDate: bajaDate,
                bajaProcess: 'T1',
                internalComments: `[Aviso] El punto de suministro ha sido traspasado a la COR (Paso 06) con fecha ${bajaDate.toISOString().split('T')[0]}.\n${contract.internalComments || ''}`,
              },
            });
            await cancelSubsequentAndOrphanContracts(contract, possibleSpIds, 'T1_06');
            extraObservacion = `El cliente ha sido traspasado a la COR. Contrato FINALIZADO con fecha ${bajaDate.toISOString().split('T')[0]}.`;
          }
        } else {
          tipoError = `T1_PASO_${paso}`;
          warning = `Proceso de traspaso a la COR (T1) en paso ${paso}. Por favor, revise manualmente.`;
        }
      } else {
        tipoError = 'CONTRATO_NO_ACTIVO';
        warning = `Aviso de traspaso a la COR (T1) en paso ${paso}, pero no se encontró un contrato ACTIVO que dar de baja para este CUPS.`;
      }
    }
    // ---------------------------------------------------------
    // 16. PROCESOS INFORMATIVOS / HISTÓRICOS (Q1, W1, P0, B1_07, C1_12, C2_12, etc.)
    // ---------------------------------------------------------
    else {
      const anyContract =
        (await findHighestActiveContract(possibleSpIds)) ||
        (await prisma.contract.findFirst({
          where: { supplyPointId: { in: possibleSpIds } },
          include: { supplyPoint: true },
          orderBy: [{ activationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        }));

      if (anyContract) {
        supplyPoint = anyContract.supplyPoint;
        supplyPointId = anyContract.supplyPointId;
        contractId = anyContract.id;
      }
    }

    // Si existe SupplyPoint en el ERP pero la casuística dio error de estado (ej. CONTRATO_NO_ACTIVO en C1_11),
    // enlazamos el último contrato histórico del CUPS solo a efectos de consulta rápida en la tabla de Eventos.
    if (!contractId && possibleSpIds.length > 0) {
      const fallbackHistoricalContract = await prisma.contract.findFirst({
        where: { supplyPointId: { in: possibleSpIds } },
        orderBy: [{ activationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, supplyPointId: true },
      });
      if (fallbackHistoricalContract) {
        contractId = fallbackHistoricalContract.id;
        supplyPointId = fallbackHistoricalContract.supplyPointId;
      }
    }
  }

  const isAnnulledEvent = Boolean(parsedData.isAnulacionAceptada);
  const finalObservaciones = [parsedData.observaciones || parsedData.tipoDeReposicion, extraObservacion]
    .filter(Boolean)
    .join(' | ') || undefined;
  const isResolved = !warning && !tipoError;

  // Guardar o actualizar SwitchingEvent
  if (existingEventId) {
    await prisma.switchingEvent.update({
      where: { id: existingEventId },
      data: {
        uniqueProcess,
        isResolved,
        contract: contractId ? { connect: { id: contractId } } : undefined,
        supplyPoint: supplyPointId ? { connect: { id: supplyPointId } } : undefined,
        tipoError: tipoError || null,
        warning: warning || null,
        estadoAR: parsedData.estadoAR ?? undefined,
        tipoReclamacion: parsedData.tipoReclamacion || undefined,
        subtipoReclamacion: parsedData.subtipoReclamacion || undefined,
        isAnnulled: isAnnulledEvent ? true : undefined,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        observaciones: finalObservaciones,
        motivosRechazo: parsedData.motivosRechazo || null,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        codigoReclamacion: parsedData.codigoReclamacion,
      },
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
        isAnnulled: isAnnulledEvent,
        tipoReclamacion: parsedData.tipoReclamacion,
        subtipoReclamacion: parsedData.subtipoReclamacion,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        observaciones: finalObservaciones,
        motivosRechazo: parsedData.motivosRechazo,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        codigoReclamacion: parsedData.codigoReclamacion,
        xmlUrl,
        isResolved,
        contractId,
        supplyPointId,
        tipoError,
        warning,
      },
      update: {
        xmlUrl,
        isResolved,
        contractId: contractId || undefined,
        supplyPointId: supplyPointId || undefined,
        tipoError: tipoError || null,
        warning: warning || null,
        estadoAR: parsedData.estadoAR ?? undefined,
        isAnnulled: isAnnulledEvent ? true : undefined,
        tipoReclamacion: parsedData.tipoReclamacion || undefined,
        subtipoReclamacion: parsedData.subtipoReclamacion || undefined,
        observaciones: finalObservaciones,
        motivosRechazo: parsedData.motivosRechazo || null,
        actuacionCampo: parsedData.actuacionCampo ?? undefined,
        fechaAR: parsedData.fechaAR,
        fechaPrevActivacion: parsedData.fechaPrevActivacion,
        fechaActivacionAlta: parsedData.fechaActivacionAlta,
        fechaActivacionBaja: parsedData.fechaActivacionBaja,
        codigoReclamacion: parsedData.codigoReclamacion,
      },
    });
  }

  return { success: true, warning };
}
