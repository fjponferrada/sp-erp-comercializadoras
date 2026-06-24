'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function getPaginatedSwitchingEventsAction(
  page: number = 1,
  limit: number = 50,
  searchTerm: string = '',
  onlyWarnings: boolean = false,
  procesoBase: string = '',
  sortBy: string = 'fechaSolicitud',
  resolveFilter: string = 'all'
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    // Build the where clause
    const whereClause: any = {};

    if (onlyWarnings) {
      whereClause.warning = { not: null };
      whereClause.isResolved = false;
    }

    if (resolveFilter === 'resolved') {
      whereClause.isResolved = true;
    } else if (resolveFilter === 'unresolved') {
      whereClause.isResolved = false;
    }

    if (procesoBase) {
      whereClause.procesoBase = procesoBase;
    } else {
      whereClause.procesoBase = { notIn: ['F1', 'R1', 'P0', 'Q1', 'W1', 'T1'] };
    }

    if (searchTerm) {
      whereClause.OR = [
        { uniqueProcess: { contains: searchTerm, mode: 'insensitive' } },
        { codigoSolicitud: { contains: searchTerm, mode: 'insensitive' } },
        { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } },
        { contract: { contractCode: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [events, totalCount] = await Promise.all([
      prisma.switchingEvent.findMany({
        where: whereClause,
        include: {
          supplyPoint: { select: { cups: true } },
          contract: { select: { contractCode: true } }
        },
        orderBy: [{ [sortBy]: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.switchingEvent.count({ where: whereClause })
    ]);

    return { success: true, events, totalCount };
  } catch (error: any) {
    console.error('Error fetching switching events:', error);
    return { success: false, error: error.message };
  }
}

export async function resolveSwitchingWarningAction(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    await prisma.switchingEvent.update({
      where: { id },
      data: { isResolved: true }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error resolving switching warning:', error);
    return { success: false, error: error.message };
  }
}

export async function unresolveSwitchingWarningAction(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    await prisma.switchingEvent.update({
      where: { id },
      data: { isResolved: false }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error unresolving switching warning:', error);
    return { success: false, error: error.message };
  }
}

import { processParsedSwitchingData } from './switchingIngest';
import { parseSwitchingXml } from '@/lib/switching/parser';

export async function retryUnresolvedSwitchingEventsAction() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const unresolvedEvents = await prisma.switchingEvent.findMany({
      where: { isResolved: false, xmlUrl: { not: null } },
      orderBy: { createdAt: 'asc' } // Procesar en orden de creación
    });

    if (unresolvedEvents.length === 0) {
      return { success: true, processedCount: 0, resolvedCount: 0 };
    }

    let processedCount = 0;
    let resolvedCount = 0;

    for (const event of unresolvedEvents) {
      try {
        const response = await fetch(event.xmlUrl!);
        if (!response.ok) continue;
        
        const xmlString = await response.text();
        const parsedData = parseSwitchingXml(xmlString);
        
        const result = await processParsedSwitchingData(parsedData, event.xmlUrl!, event.id);
        
        processedCount++;
        // processParsedSwitchingData ya actualiza el SwitchingEvent en DB
        if (result.success && !result.warning) {
          resolvedCount++;
        }
      } catch (e) {
        console.error('Error retrying event:', event.id, e);
      }
    }

    return { success: true, processedCount, resolvedCount };
  } catch (error: any) {
    console.error('Error retrying switching events:', error);
    return { success: false, error: error.message };
  }
}

export async function getDistributorScrapingStatus() {
  try {
    const configs = await prisma.distributor.findMany({
      where: { webScrapingActive: true },
      select: { name: true, webLastSyncAt: true }
    });
    return configs;
  } catch (error) {
    console.error("Error fetching scraping status:", error);
    return [];
  }
}
