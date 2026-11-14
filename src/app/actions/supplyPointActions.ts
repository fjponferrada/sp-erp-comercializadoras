'use server'

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function getPaginatedSupplyPointsAction(page: number, limit: number, search: string = '') {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { success: false, error: 'Usuario no encontrado' };

  try {
    const skip = (page - 1) * limit;

    const { getSupplyPointVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getSupplyPointVisibilityFilter();

    let whereClause: any = {
      AND: [{ ...visibilityFilter }]
    };

    if (search.trim() !== '') {
      const isCupsSearch = search.toUpperCase().startsWith('ES') || /[A-Z0-9]{15,}/i.test(search);
      if (isCupsSearch) {
        whereClause.AND.push({ cups: { contains: search, mode: 'insensitive' } });
      } else {
        whereClause.AND.push({
          OR: [
            { cups: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            {
              client: {
                OR: [
                  { businessName: { contains: search, mode: 'insensitive' } },
                  { vatNumber: { contains: search, mode: 'insensitive' } }
                ]
              }
            }
          ]
        });
      }
    }

    const [totalCount, supplyPoints] = await Promise.all([
      prisma.supplyPoint.count({ where: whereClause }),
      prisma.supplyPoint.findMany({
        where: whereClause,
        include: {
          client: true,
          contracts: {
            where: { status: 'ACTIVO' },
            take: 1
          }
        },
        skip,
        take: limit,
        orderBy: { id: 'desc' }
      })
    ]);

    return { success: true, supplyPoints, totalCount };
  } catch (error: any) {
    console.error('Error in getPaginatedSupplyPointsAction:', error);
    return { success: false, error: error.message };
  }
}

export async function getSupplyPointDetailsAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const { getSupplyPointVisibilityFilter, getUserVisibilityFilter } = await import('@/lib/permissions');
    const spFilter = await getSupplyPointVisibilityFilter();
    const contractFilter = await getUserVisibilityFilter();

    const supplyPoint = await prisma.supplyPoint.findFirst({
      where: { 
        id,
        AND: [spFilter]
      },
      include: {
        client: true,
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        contracts: {
          where: contractFilter,
          orderBy: { createdAt: 'desc' },
          include: {
            product: true,
            user: true
          }
        }
      }
    });

    if (!supplyPoint) {
      return { success: false, error: 'Punto de suministro no encontrado' };
    }

    return { success: true, supplyPoint };
  } catch (error: any) {
    console.error('Error in getSupplyPointDetailsAction:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSupplyPointAction(id: string, data: any) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const { getSupplyPointVisibilityFilter } = await import('@/lib/permissions');
    const spFilter = await getSupplyPointVisibilityFilter();
    const existingSp = await prisma.supplyPoint.findFirst({
      where: { id, AND: [spFilter] },
      select: { id: true },
    });
    if (!existingSp) {
      return { success: false, error: 'Punto de suministro no encontrado o sin permisos' };
    }

    const regimenFiscal = (data.regimenFiscal || 'SBFO').trim().toUpperCase();
    const { validateCieForRegimen } = await import('@/lib/taxUtils');
    const cieValidation = validateCieForRegimen(data.cie, regimenFiscal);
    if (!cieValidation.valid) {
      return { success: false, error: cieValidation.error || 'CIE inválido para el régimen fiscal seleccionado' };
    }

    let parsedIeDiscount = data.ieDiscount !== '' && data.ieDiscount !== null && data.ieDiscount !== undefined
      ? parseFloat(data.ieDiscount)
      : null;
    if (regimenFiscal.startsWith('98.1') && (!parsedIeDiscount || parsedIeDiscount <= 0)) {
      parsedIeDiscount = 85;
    } else if ((regimenFiscal === '98.2' || regimenFiscal === '98.3') && (!parsedIeDiscount || parsedIeDiscount <= 0)) {
      parsedIeDiscount = 100;
    } else if (regimenFiscal === 'SBFO' || regimenFiscal === 'SBFI' || regimenFiscal.startsWith('94.')) {
      parsedIeDiscount = null;
    }

    const addressParts = [
      data.streetType,
      data.street,
      data.streetNumber ? `NÚM ${data.streetNumber}` : null,
      data.floor ? `Piso ${data.floor}` : null,
      data.door ? `Puerta ${data.door}` : null,
      data.addressAddition
    ].filter(Boolean);
    const computedAddress = addressParts.join(' ').trim();

    const { calculateSegment } = await import('@/lib/services/SegmentService');
    const newSegment = calculateSegment(
      data.tariff || null,
      data.annualConsumption ? parseFloat(data.annualConsumption) : null,
      data.p1c ? parseFloat(data.p1c) : null,
      data.cnae || null
    );

    const updated = await prisma.supplyPoint.update({
      where: { id },
      data: {
        segment: newSegment,
        address: computedAddress,
        streetType: data.streetType,
        street: data.street,
        streetNumber: data.streetNumber,
        floor: data.floor,
        door: data.door,
        addressAddition: data.addressAddition,
        postalCode: data.postalCode,
        city: data.city,
        province: data.province,
        tariff: data.tariff,
        annualConsumption: data.annualConsumption ? parseFloat(data.annualConsumption) : null,
        distributor: data.distributor,
        cnae: data.cnae,
        iban: data.iban,
        swift: data.swift,
        p1c: data.p1c ? parseFloat(data.p1c) : null,
        p2c: data.p2c ? parseFloat(data.p2c) : null,
        p3c: data.p3c ? parseFloat(data.p3c) : null,
        p4c: data.p4c ? parseFloat(data.p4c) : null,
        p5c: data.p5c ? parseFloat(data.p5c) : null,
        p6c: data.p6c ? parseFloat(data.p6c) : null,
        hasSelfConsumption: data.hasSelfConsumption === true || data.hasSelfConsumption === 'true',
        selfConsumptionType: data.selfConsumptionType || null,
        isBimonthly: data.isBimonthly === true || data.isBimonthly === 'true',
        cie: cieValidation.normalizedCie || null,
        ieDiscount: parsedIeDiscount,
        regimenFiscal,
      }
    });

    revalidatePath('/puntos-suministro');
    revalidatePath(`/clientes/${updated.clientId}`);
    return { success: true, supplyPoint: updated };
  } catch (error: any) {
    console.error('Error in updateSupplyPointAction:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSupplyPointSipsAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const supplyPoint = await prisma.supplyPoint.findUnique({
      where: { id },
      select: { cups: true }
    });

    if (!supplyPoint || !supplyPoint.cups) {
      return { success: false, error: 'Punto de suministro no encontrado o sin CUPS' };
    }

    const { getSipsData } = await import('@/lib/sips');
    const sipsData = await getSipsData(supplyPoint.cups);

    if (!sipsData || sipsData.result === 'ERROR') {
      return { 
        success: false, 
        error: sipsData?.message || 'Error al consultar SIPS' 
      };
    }

    // Actualizamos el JSON
    const updated = await prisma.supplyPoint.update({
      where: { id },
      data: {
        sipsRawData: sipsData as any
      }
    });

    revalidatePath(`/puntos-suministro/${id}`);
    
    return { success: true, sipsData: updated.sipsRawData };
  } catch (error: any) {
    console.error('Error in updateSupplyPointSipsAction:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchSipsForPricingAction(cups: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  const cleanCups = (cups || '').trim().toUpperCase();
  if (cleanCups.length < 20 || cleanCups.startsWith('CUPS_MOCK_')) {
    return { success: false, error: 'Introduce un código CUPS real válido (mínimo 20 caracteres).' };
  }

  const cups20 = cleanCups.substring(0, 20);

  const normalizeTariffCode = (rawT: string): string => {
    const t = (rawT || '').trim().replace(/\s+/g, '').toUpperCase();
    if (t.includes('3.0TDVE')) return '3.0TDVE';
    if (t.includes('6.1TDVE')) return '6.1TDVE';
    if (t.includes('2.0')) return '2.0TD';
    if (t.includes('3.0')) return '3.0TD';
    if (t.includes('6.1')) return '6.1TD';
    if (t.includes('6.2')) return '6.2TD';
    if (t.includes('6.3')) return '6.3TD';
    if (t.includes('6.4')) return '6.4TD';
    return '';
  };

  try {
    // 1. Consultar datos propios en nuestro ERP (SupplyPoint + telemedida LoadCurve últimos 365 días)
    const [spRecord, rawCurves] = await Promise.all([
      prisma.supplyPoint.findFirst({
        where: {
          cups: { startsWith: cups20 },
          NOT: { cups: { startsWith: 'CUPS_MOCK_' } },
        },
        select: {
          id: true,
          cups: true,
          tariff: true,
          annualConsumption: true,
          sipsRawData: true,
          client: { select: { businessName: true } },
        },
      }),
      prisma.loadCurve.findMany({
        where: {
          cups: { startsWith: cups20 },
          type: 'CONSUMPTION',
        },
        orderBy: { date: 'desc' },
        take: 400, // margen por posibles duplicados 20 vs 22 caracteres
      }),
    ]);

    // Deduplicar curvas por fecha YYYY-MM-DD y quedarnos con los últimos 365 días ordenados cronológicamente
    const byDate = new Map<string, (typeof rawCurves)[number]>();
    for (const lc of rawCurves) {
      const ymd = lc.date.toISOString().split('T')[0];
      if (!byDate.has(ymd)) byDate.set(ymd, lc);
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    const recentDates = sortedDates.slice(-365);

    let dbCchData: number[] | null = null;
    let dbCchStartDate: string | undefined = undefined;
    let dbCchDays = 0;
    let dbCchTotalKwh = 0;

    if (recentDates.length >= 15) {
      dbCchDays = recentDates.length;
      dbCchStartDate = recentDates[0];
      dbCchData = [];

      for (const ymd of recentDates) {
        const lc = byDate.get(ymd)!;
        const vals = lc.readings || [];
        const isQuarterly = lc.resolution === 'QUARTER_HOURLY' || vals.length >= 92;
        if (isQuarterly) {
          for (let h = 0; h < 24; h++) {
            const hkwh =
              (vals[h * 4] || 0) +
              (vals[h * 4 + 1] || 0) +
              (vals[h * 4 + 2] || 0) +
              (vals[h * 4 + 3] || 0);
            dbCchData.push(hkwh);
            dbCchTotalKwh += hkwh;
          }
        } else {
          for (let h = 0; h < 24; h++) {
            const hkwh = vals[h] || 0;
            dbCchData.push(hkwh);
            dbCchTotalKwh += hkwh;
          }
        }
      }
    }

    // 2. Consultar SIPS (INGEBAU) en tiempo real, con fallback a sipsRawData guardado en BD si falla la red
    let sipsData: any = null;
    try {
      const { getSipsData } = await import('@/lib/sips');
      sipsData = await getSipsData(cleanCups);
    } catch {
      sipsData = null;
    }

    if ((!sipsData || sipsData.result === 'ERROR') && spRecord?.sipsRawData) {
      sipsData = spRecord.sipsRawData;
    }

    let tarifa = normalizeTariffCode(spRecord?.tariff || '');
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0;

    if (sipsData && sipsData.result !== 'ERROR') {
      let psData: any = null;
      const raw: any = sipsData;
      if (raw.data && raw.data.ps && raw.data.ps.length > 0) psData = raw.data.ps[0];
      else if (raw.ps && raw.ps.length > 0) psData = raw.ps[0];
      else if (raw.CUPS || raw.CNAE || raw.TarifaATR) psData = raw;

      if (psData?.TarifaATR) {
        const sipsTariff = normalizeTariffCode(psData.TarifaATR);
        if (sipsTariff) tarifa = sipsTariff;
      }

      const consumosArr = raw.data?.consumos || raw.consumos || [];
      if (Array.isArray(consumosArr) && consumosArr.length > 0) {
        let maxDate = 0;
        for (const row of consumosArr) {
          if (row.LecturaHasta) {
            const d = new Date(row.LecturaHasta).getTime();
            if (!isNaN(d) && d > maxDate) maxDate = d;
          }
        }
        const cutoff = maxDate > 0 ? maxDate - 365 * 24 * 60 * 60 * 1000 : 0;

        for (const row of consumosArr) {
          let rowMaxDate = 0;
          if (row.LecturaHasta) {
            const d = new Date(row.LecturaHasta).getTime();
            if (!isNaN(d)) rowMaxDate = d;
          }
          if (rowMaxDate > 0 && rowMaxDate < cutoff) continue;

          p1 += Number(row['EnergiaActivaP1(kWh)'] || row['energiaActivaP1(kWh)'] || 0);
          p2 += Number(row['EnergiaActivaP2(kWh)'] || row['energiaActivaP2(kWh)'] || 0);
          p3 += Number(row['EnergiaActivaP3(kWh)'] || row['energiaActivaP3(kWh)'] || 0);
          p4 += Number(row['EnergiaActivaP4(kWh)'] || row['energiaActivaP4(kWh)'] || 0);
          p5 += Number(row['EnergiaActivaP5(kWh)'] || row['energiaActivaP5(kWh)'] || 0);
          p6 += Number(row['EnergiaActivaP6(kWh)'] || row['energiaActivaP6(kWh)'] || 0);
        }
      }

      if (p1 + p2 + p3 + p4 + p5 + p6 === 0 && psData) {
        p1 = Number(psData.ConsumoAnualP1kWh) || 0;
        p2 = Number(psData.ConsumoAnualP2kWh) || 0;
        p3 = Number(psData.ConsumoAnualP3kWh) || 0;
        p4 = Number(psData.ConsumoAnualP4kWh) || 0;
        p5 = Number(psData.ConsumoAnualP5kWh) || 0;
        p6 = Number(psData.ConsumoAnualP6kWh) || 0;
      }
    }

    // 3. Si SIPS no devolvió consumos pero tenemos telemedida CCH en nuestro ERP, clasificamos sus horas por periodo CNMC
    if (p1 + p2 + p3 + p4 + p5 + p6 === 0 && dbCchData && dbCchDays > 0) {
      const { PricingEngine } = await import('@/lib/services/PricingEngine');
      const effectiveTariff = tarifa || '2.0TD';
      const annualFactor = 365 / dbCchDays;
      let idx = 0;
      for (const ymd of recentDates) {
        const [yy, mm, dd] = ymd.split('-').map(Number);
        for (let h = 0; h < 24; h++) {
          const val = (dbCchData[idx++] || 0) * annualFactor;
          // Usamos mediodía UTC - offset aproximado o construimos hora local exacta
          const dtApprox = new Date(Date.UTC(yy, mm - 1, dd, h, 0, 0) - 3600000);
          const per = PricingEngine.getPeriodo(dtApprox, effectiveTariff, false);
          if (per === 'P1') p1 += val;
          else if (per === 'P2') p2 += val;
          else if (per === 'P3') p3 += val;
          else if (per === 'P4') p4 += val;
          else if (per === 'P5') p5 += val;
          else p6 += val;
        }
      }
    }

    const hasSipsPeriods = p1 + p2 + p3 + p4 + p5 + p6 > 0;
    const hasDbCch = !!(dbCchData && dbCchTotalKwh > 0);

    if (!hasSipsPeriods && !hasDbCch) {
      return {
        success: false,
        error:
          sipsData?.message ||
          'No se encontraron consumos en SIPS ni telemedida CCH en el ERP para este CUPS. Utiliza el modo Cálculo Genérico.',
      };
    }

    return {
      success: true,
      tarifa: tarifa || '2.0TD',
      clientName: spRecord?.client?.businessName || null,
      consumos: hasSipsPeriods
        ? {
            p1: Math.round(p1 * 100) / 100,
            p2: Math.round(p2 * 100) / 100,
            p3: Math.round(p3 * 100) / 100,
            p4: Math.round(p4 * 100) / 100,
            p5: Math.round(p5 * 100) / 100,
            p6: Math.round(p6 * 100) / 100,
          }
        : null,
      dbCchData: hasDbCch ? dbCchData : null,
      dbCchStartDate: hasDbCch ? dbCchStartDate : undefined,
      dbCchDays: hasDbCch ? dbCchDays : 0,
      dbCchTotalKwh: hasDbCch ? Math.round(dbCchTotalKwh * 100) / 100 : 0,
    };
  } catch (error: any) {
    console.error('Error in fetchSipsForPricingAction:', error);
    return { success: false, error: 'Error al consultar SIPS / ERP para este CUPS.' };
  }
}
