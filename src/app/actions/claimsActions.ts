'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export interface ClaimSummary {
  codigoSolicitud: string;
  cups: string;
  codigoReclamacion: string | null;
  diasAbierta: number | null;
  paso01: {
    fecha: Date | null;
    xmlUrl: string | null;
  } | null;
  paso02: {
    fecha: Date | null;
    xmlUrl: string | null;
  } | null;
  paso03: {
    comentario: string | null;
    xmlUrl: string | null;
  } | null;
  paso05: {
    comentario: string | null;
    xmlUrl: string | null;
  } | null;
}

export async function getClaimsAction(contractId?: string): Promise<{ success: true; data: ClaimSummary[] } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const whereClause: any = { procesoBase: 'R1' };
    if (contractId) {
      whereClause.contractId = contractId;
    }

    const events = await prisma.switchingEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: {
        supplyPoint: true,
      }
    });

    const claimsMap = new Map<string, ClaimSummary>();

    for (const event of events) {
      const codigo = event.codigoSolicitud || 'SIN_CODIGO';
      
      let cupsFallback = event.supplyPoint?.cups || '';
      if (!cupsFallback && event.uniqueProcess) {
        const match = event.uniqueProcess.match(/ES[a-zA-Z0-9]{18,22}/);
        if (match) cupsFallback = match[0];
      }
      if (!cupsFallback && event.xmlUrl) {
        const match = event.xmlUrl.match(/ES[a-zA-Z0-9]{18,22}/);
        if (match) cupsFallback = match[0];
      }
      
      if (!claimsMap.has(codigo)) {
        claimsMap.set(codigo, {
          codigoSolicitud: codigo,
          cups: cupsFallback,
          codigoReclamacion: null,
          diasAbierta: null,
          paso01: null,
          paso02: null,
          paso03: null,
          paso05: null,
        });
      }

      const claim = claimsMap.get(codigo)!;
      
      if (event.codigoReclamacion && !claim.codigoReclamacion) {
         claim.codigoReclamacion = event.codigoReclamacion;
      }

      if (event.paso === '01') {
        claim.paso01 = { fecha: event.fechaSolicitud || event.createdAt, xmlUrl: event.xmlUrl };
      } else if (event.paso === '02') {
        claim.paso02 = { fecha: event.fechaAR || event.fechaSolicitud || event.createdAt, xmlUrl: event.xmlUrl };
      } else if (event.paso === '03') {
        claim.paso03 = { comentario: event.observaciones || null, xmlUrl: event.xmlUrl };
      } else if (event.paso === '05') {
        claim.paso05 = { comentario: event.observaciones || null, xmlUrl: event.xmlUrl };
      }
    }

    const claims = Array.from(claimsMap.values());

    // Calculate diasAbierta
    const now = new Date();
    // Normalizar now a principio del dia para evitar diferencias de horas
    now.setHours(0, 0, 0, 0);

    for (const claim of claims) {
      if (!claim.paso05 && claim.paso02?.fecha) {
        const d2 = new Date(claim.paso02.fecha);
        d2.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now.getTime() - d2.getTime());
        claim.diasAbierta = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } else if (!claim.paso05 && claim.paso01?.fecha) {
        const d1 = new Date(claim.paso01.fecha);
        d1.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now.getTime() - d1.getTime());
        claim.diasAbierta = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Sort descending by paso01 date
    claims.sort((a, b) => {
      const dateA = a.paso01?.fecha || new Date(0);
      const dateB = b.paso01?.fecha || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return { success: true, data: claims };

  } catch (error: any) {
    console.error('Error fetching claims:', error);
    return { success: false, error: error.message };
  }
}
