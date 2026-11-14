'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getSupplyPointVisibilityFilter } from '@/lib/permissions';
import { resolveActiveCompanyId } from '@/lib/companyContext';
import {
  MOTIVOS_R1,
  SUBMOTIVOS_R1,
  RESULTADOS_R1,
  normalizeTipoR1,
  normalizeSubtipoR1,
} from '@/app/(app)/reclamaciones/utils/cnmc_codes';

export type ClaimIntegratedStatus =
  | 'Aceptada'
  | 'En Proceso'
  | 'Pte. Info (Paso 03)'
  | 'Rechazada'
  | 'Cerrada'
  | 'Anulada'
  | 'Desconocido';

export interface ClaimSummary {
  codigoSolicitud: string;
  cups: string;
  titular?: string | null;
  contractId?: string | null;
  supplyPointId?: string | null;
  codigoReclamacion: string | null;
  diasAbierta: number | null;
  tipoReclamacion: string | null;
  subtipoReclamacion: string | null;
  anulada: boolean;
  estadoIntegrado: ClaimIntegratedStatus;
  paso01: {
    fecha: Date | null;
    xmlUrl: string | null;
    comentario: string | null;
  } | null;
  paso02: {
    fecha: Date | null;
    xmlUrl: string | null;
    estadoAR: string | null;
    comentario: string | null;
    motivosRechazo?: any;
  } | null;
  paso03: {
    fecha: Date | null;
    comentario: string | null;
    xmlUrl: string | null;
    tipoComunicacion: string | null;
    fechaLimiteEnvio: Date | null;
    requiereRespuesta: boolean;
    historial: Array<{
      fecha: Date | null;
      tipoComunicacion: string | null;
      comentario: string | null;
      fechaLimiteEnvio: Date | null;
      xmlUrl: string | null;
    }>;
  } | null;
  paso04: {
    fecha: Date | null;
    comentario: string | null;
    xmlUrl: string | null;
    historial: Array<{
      fecha: Date | null;
      comentario: string | null;
      xmlUrl: string | null;
    }>;
  } | null;
  paso05: {
    fecha: Date | null;
    comentario: string | null;
    xmlUrl: string | null;
    resultadoCodigo: string | null;
    resultadoDescripcion: string | null;
    detalleResultado: string | null;
    indemnizacion: number | null;
  } | null;
}

export interface ClaimScopeFilter {
  contractId?: string;
  supplyPointIds?: string[];
}

export async function getClaimsAction(
  scope?: string | ClaimScopeFilter,
  page: number = 1,
  limit: number = 100,
  searchTerm: string = '',
  statusFilter: string = 'ALL'
): Promise<
  | {
      success: true;
      data: ClaimSummary[];
      totalCount: number;
      statusCounts: Record<string, number>;
    }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const spFilter = await getSupplyPointVisibilityFilter();
    const hasSpRestriction = Object.keys(spFilter).length > 0;
    const activeCompanyId = await resolveActiveCompanyId(session);

    const whereClause: any = { procesoBase: 'R1' };
    if (hasSpRestriction) {
      whereClause.supplyPoint = spFilter;
    } else if (activeCompanyId) {
      whereClause.AND = [
        {
          OR: [
            { contract: { brand: { companyId: activeCompanyId } } },
            { supplyPoint: { client: { brand: { companyId: activeCompanyId } } } },
            { AND: [{ contractId: null }, { supplyPointId: null }] },
          ],
        },
      ];
    }

    // Resolver alcance por contrato o puntos de suministro del CUPS (clones incluidos según Regla 21)
    if (scope) {
      const contractId = typeof scope === 'string' ? scope : scope.contractId;
      const supplyPointIds = typeof scope === 'object' && Array.isArray(scope.supplyPointIds) ? scope.supplyPointIds : [];
      const orConditions: any[] = [];
      if (contractId) orConditions.push({ contractId });
      if (supplyPointIds.length > 0) orConditions.push({ supplyPointId: { in: supplyPointIds } });

      if (orConditions.length > 0) {
        const seedEvents = await prisma.switchingEvent.findMany({
          where: {
            ...whereClause,
            OR: orConditions,
          },
          select: { codigoSolicitud: true, id: true },
        });

        const codigos = Array.from(new Set(seedEvents.map((e) => e.codigoSolicitud).filter(Boolean))) as string[];
        const orphanIds = seedEvents.filter((e) => !e.codigoSolicitud).map((e) => e.id);

        if (codigos.length === 0 && orphanIds.length === 0) {
          return { success: true, data: [], totalCount: 0, statusCounts: { ALL: 0 } };
        }

        const fullOr: any[] = [];
        if (codigos.length > 0) fullOr.push({ codigoSolicitud: { in: codigos } });
        if (orphanIds.length > 0) fullOr.push({ id: { in: orphanIds } });
        whereClause.OR = fullOr;
      }
    }

    const events = await prisma.switchingEvent.findMany({
      where: whereClause,
      orderBy: [{ fechaSolicitud: 'asc' }, { createdAt: 'asc' }],
      include: {
        supplyPoint: {
          include: {
            client: {
              select: { businessName: true, firstName: true, lastName: true, lastName2: true, vatNumber: true },
            },
          },
        },
        contract: {
          select: {
            id: true,
            client: {
              select: { businessName: true, firstName: true, lastName: true, lastName2: true, vatNumber: true },
            },
          },
        },
      },
    });

    const claimsMap = new Map<string, ClaimSummary>();

    for (const event of events) {
      const codigo = event.codigoSolicitud || `SIN_CODIGO_${event.id}`;

      let cupsFallback = event.supplyPoint?.cups || '';
      if (!cupsFallback && event.uniqueProcess) {
        const match = event.uniqueProcess.match(/ES[a-zA-Z0-9]{18,22}/);
        if (match) cupsFallback = match[0];
      }
      if (!cupsFallback && event.xmlUrl) {
        const match = event.xmlUrl.match(/ES[a-zA-Z0-9]{18,22}/);
        if (match) cupsFallback = match[0];
      }

      const evClient = event.contract?.client || event.supplyPoint?.client;
      const titularFallback = evClient
        ? evClient.businessName || `${evClient.firstName || ''} ${evClient.lastName || ''} ${evClient.lastName2 || ''}`.trim() || null
        : null;

      if (!claimsMap.has(codigo)) {
        claimsMap.set(codigo, {
          codigoSolicitud: event.codigoSolicitud || 'SIN_CODIGO',
          cups: cupsFallback,
          titular: titularFallback,
          contractId: event.contractId || null,
          supplyPointId: event.supplyPointId || null,
          codigoReclamacion: null,
          diasAbierta: null,
          tipoReclamacion: null,
          subtipoReclamacion: null,
          anulada: false,
          estadoIntegrado: 'Desconocido',
          paso01: null,
          paso02: null,
          paso03: null,
          paso04: null,
          paso05: null,
        });
      }

      const claim = claimsMap.get(codigo)!;

      if (!claim.cups && cupsFallback) claim.cups = cupsFallback;
      if (!claim.titular && titularFallback) claim.titular = titularFallback;
      if (!claim.contractId && event.contractId) claim.contractId = event.contractId;
      if (!claim.supplyPointId && event.supplyPointId) claim.supplyPointId = event.supplyPointId;
      if (event.isAnnulled) claim.anulada = true;

      if (event.codigoReclamacion) {
        claim.codigoReclamacion = event.codigoReclamacion;
      }

      // Actualizar Tipo y Subtipo normalizados (permitiendo que retipificación en Paso 03 o cierre en Paso 05 actualice el código)
      const normTipo = normalizeTipoR1(event.tipoReclamacion);
      const normSubtipo = normalizeSubtipoR1(event.subtipoReclamacion);
      if (normTipo && (!claim.tipoReclamacion || event.paso === '03' || event.paso === '05')) {
        claim.tipoReclamacion = normTipo;
      }
      if (normSubtipo && (!claim.subtipoReclamacion || event.paso === '03' || event.paso === '05')) {
        claim.subtipoReclamacion = normSubtipo;
      }

      if (event.paso === '01') {
        claim.paso01 = {
          fecha: event.fechaSolicitud || event.createdAt,
          xmlUrl: event.xmlUrl,
          comentario: event.observaciones || null,
        };
      } else if (event.paso === '02') {
        claim.paso02 = {
          fecha: event.fechaAR || event.fechaSolicitud || event.createdAt,
          xmlUrl: event.xmlUrl,
          estadoAR: event.estadoAR,
          comentario: event.observaciones || null,
          motivosRechazo: event.motivosRechazo || undefined,
        };
      } else if (event.paso === '03') {
        const meta = (event.motivosRechazo && typeof event.motivosRechazo === 'object' && !Array.isArray(event.motivosRechazo))
          ? (event.motivosRechazo as any)
          : {};
        let tipoCom: string | null = meta.tipoComunicacion || null;
        if (!tipoCom && event.estadoAR?.startsWith('COM_')) {
          tipoCom = event.estadoAR.replace('COM_', '');
        }
        const fechaPaso03 = event.fechaSolicitud || event.createdAt;
        const fechaLimite = event.fechaPrevActivacion || (meta.fechaLimiteEnvio ? new Date(meta.fechaLimiteEnvio) : null);
        const validFechaLimite = fechaLimite && !isNaN(fechaLimite.getTime()) ? fechaLimite : null;
        const item = {
          fecha: fechaPaso03,
          tipoComunicacion: tipoCom,
          comentario: event.observaciones || null,
          fechaLimiteEnvio: validFechaLimite,
          xmlUrl: event.xmlUrl,
        };
        const prevHistorial = claim.paso03?.historial || [];
        prevHistorial.push(item);

        claim.paso03 = {
          fecha: fechaPaso03,
          comentario: event.observaciones || claim.paso03?.comentario || null,
          xmlUrl: event.xmlUrl || claim.paso03?.xmlUrl || null,
          tipoComunicacion: tipoCom,
          fechaLimiteEnvio: validFechaLimite || claim.paso03?.fechaLimiteEnvio || null,
          requiereRespuesta: tipoCom === '01' || tipoCom === '04',
          historial: prevHistorial,
        };
      } else if (event.paso === '04') {
        const fechaPaso04 = event.fechaAR || event.fechaSolicitud || event.createdAt;
        const item = {
          fecha: fechaPaso04,
          comentario: event.observaciones || null,
          xmlUrl: event.xmlUrl,
        };
        const prevHistorial = claim.paso04?.historial || [];
        prevHistorial.push(item);
        claim.paso04 = {
          fecha: fechaPaso04,
          comentario: event.observaciones || claim.paso04?.comentario || null,
          xmlUrl: event.xmlUrl || claim.paso04?.xmlUrl || null,
          historial: prevHistorial,
        };
      } else if (event.paso === '05') {
        const meta = (event.motivosRechazo && typeof event.motivosRechazo === 'object' && !Array.isArray(event.motivosRechazo))
          ? (event.motivosRechazo as any)
          : {};
        let resCod: string | null = meta.resultado || null;
        if (!resCod && event.estadoAR?.startsWith('RES_')) {
          resCod = event.estadoAR.replace('RES_', '');
        }
        const resDesc = resCod ? (RESULTADOS_R1[resCod] || resCod) : null;
        claim.paso05 = {
          fecha: event.fechaActivacionAlta || event.fechaSolicitud || event.createdAt,
          comentario: event.observaciones || null,
          xmlUrl: event.xmlUrl,
          resultadoCodigo: resCod,
          resultadoDescripcion: resDesc,
          detalleResultado: meta.detalleResultado || null,
          indemnizacion: typeof meta.indemnizacionAbonada === 'number' ? meta.indemnizacionAbonada : null,
        };
      } else if (event.paso === '09' && event.estadoAR === 'ACEPTADO') {
        claim.anulada = true;
      }
    }

    const claims = Array.from(claimsMap.values());

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const claim of claims) {
      // Si ya se envió un Paso 04 posterior o igual al último Paso 03, ya no está pendiente de aportar información
      if (claim.paso03?.requiereRespuesta && claim.paso04?.fecha && claim.paso03.fecha) {
        if (new Date(claim.paso04.fecha).getTime() >= new Date(claim.paso03.fecha).getTime()) {
          claim.paso03.requiereRespuesta = false;
        }
      }

      if (claim.anulada) {
        claim.estadoIntegrado = 'Anulada';
      } else if (claim.paso05) {
        claim.estadoIntegrado = 'Cerrada';
      } else if (claim.paso02?.estadoAR === 'RECHAZADO') {
        claim.estadoIntegrado = 'Rechazada';
      } else if (claim.paso03?.requiereRespuesta) {
        claim.estadoIntegrado = 'Pte. Info (Paso 03)';
      } else if (claim.paso02) {
        claim.estadoIntegrado = 'Aceptada';
      } else if (claim.paso01 || claim.paso03 || claim.paso04) {
        claim.estadoIntegrado = 'En Proceso';
      }

      // Calcular días abierta solo para reclamaciones vivas
      if (
        claim.estadoIntegrado === 'En Proceso' ||
        claim.estadoIntegrado === 'Aceptada' ||
        claim.estadoIntegrado === 'Pte. Info (Paso 03)'
      ) {
        const refDateStr = claim.paso02?.fecha || claim.paso01?.fecha || claim.paso03?.fecha;
        if (refDateStr) {
          const refDate = new Date(refDateStr);
          refDate.setHours(0, 0, 0, 0);
          const diffTime = Math.max(0, now.getTime() - refDate.getTime());
          claim.diasAbierta = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
      } else {
        claim.diasAbierta = null;
      }
    }

    // Filtrar por término de búsqueda
    let searchedClaims = claims;
    if (searchTerm && searchTerm.trim() !== '') {
      const lowerTerm = searchTerm.trim().toLowerCase();
      searchedClaims = claims.filter((c) => {
        const tipoDesc = c.tipoReclamacion ? (MOTIVOS_R1[c.tipoReclamacion] || '').toLowerCase() : '';
        const subtipoDesc = c.subtipoReclamacion ? (SUBMOTIVOS_R1[c.subtipoReclamacion] || '').toLowerCase() : '';
        return (
          (c.codigoSolicitud && c.codigoSolicitud.toLowerCase().includes(lowerTerm)) ||
          (c.cups && c.cups.toLowerCase().includes(lowerTerm)) ||
          (c.codigoReclamacion && c.codigoReclamacion.toLowerCase().includes(lowerTerm)) ||
          (c.titular && c.titular.toLowerCase().includes(lowerTerm)) ||
          (c.tipoReclamacion && c.tipoReclamacion.toLowerCase().includes(lowerTerm)) ||
          (c.subtipoReclamacion && c.subtipoReclamacion.toLowerCase().includes(lowerTerm)) ||
          tipoDesc.includes(lowerTerm) ||
          subtipoDesc.includes(lowerTerm) ||
          (c.paso05?.comentario && c.paso05.comentario.toLowerCase().includes(lowerTerm)) ||
          (c.paso03?.comentario && c.paso03.comentario.toLowerCase().includes(lowerTerm))
        );
      });
    }

    // Contadores por estado sobre el conjunto filtrado por búsqueda
    const statusCounts: Record<string, number> = {
      ALL: searchedClaims.length,
      'En Proceso': 0,
      'Pte. Info (Paso 03)': 0,
      Aceptada: 0,
      Cerrada: 0,
      Rechazada: 0,
      Anulada: 0,
    };
    for (const c of searchedClaims) {
      statusCounts[c.estadoIntegrado] = (statusCounts[c.estadoIntegrado] || 0) + 1;
    }

    // Filtrar por estado si aplica
    let finalClaims = searchedClaims;
    if (statusFilter && statusFilter !== 'ALL') {
      finalClaims = searchedClaims.filter((c) => c.estadoIntegrado === statusFilter);
    }

    // Ordenar descendente por fecha Paso 01 (fallback Paso 02 / Paso 05)
    finalClaims.sort((a, b) => {
      const dateA = a.paso01?.fecha || a.paso02?.fecha || a.paso05?.fecha || new Date(0);
      const dateB = b.paso01?.fecha || b.paso02?.fecha || b.paso05?.fecha || new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    const totalCount = finalClaims.length;
    const paginatedClaims = limit > 0 ? finalClaims.slice((page - 1) * limit, page * limit) : finalClaims;

    return { success: true, data: paginatedClaims, totalCount, statusCounts };
  } catch (error: any) {
    console.error('Error fetching claims:', error);
    return { success: false, error: error.message };
  }
}
