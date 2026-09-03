'use server';

import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';

export async function getPaginatedBajasAction(
  page: number,
  itemsPerPage: number,
  search: string,
  motivoFilter: string,
  canalFilter: string = 'TODOS',
  origenBajaFilter: string[] = [],
  dateFrom?: string | null,
  dateTo?: string | null,
  tarifaFilter: string[] = []
) {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    // 1. Fetch all lightweight contracts to calculate "net bajas" (same as Dashboard)
    const allContracts = await prisma.contract.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] }
      },
      select: {
        id: true,
        activationDate: true,
        terminationDate: true,
        permanenceStartDate: true,
        createdAt: true,
        supplyPoint: { select: { cups: true } }
      }
    });

    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const contractsByCups: Record<string, (typeof allContracts[0] & { _effActDate: Date })[]> = {};
    
    allContracts.forEach(c => {
      const cupsStr = c.supplyPoint?.cups;
      if (!cupsStr) return;
      const effActDate = c.activationDate || c.permanenceStartDate || c.createdAt;
      if (!effActDate) return;
      
      if (!contractsByCups[cupsStr]) contractsByCups[cupsStr] = [];
      contractsByCups[cupsStr].push({ ...c, _effActDate: effActDate });
    });

    const realBajaContractIds: string[] = [];

    Object.values(contractsByCups).forEach(cupsContracts => {
      cupsContracts.sort((a, b) => a._effActDate.getTime() - b._effActDate.getTime());

      let currentPeriod: { end: Date | null, endContractId: string | null } | null = null;

      for (const c of cupsContracts) {
        if (!currentPeriod) {
          currentPeriod = { end: c.terminationDate || null, endContractId: c.id };
          continue;
        }

        const startNext = c._effActDate;
        
        if (currentPeriod.end === null) {
          // Open period, remains open
        } else {
          if (startNext.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
            // Merged period (Renewal / Continuation)
            if (!c.terminationDate) {
              currentPeriod.end = null;
              currentPeriod.endContractId = c.id;
            } else if (c.terminationDate.getTime() > currentPeriod.end.getTime()) {
              currentPeriod.end = c.terminationDate;
              currentPeriod.endContractId = c.id;
            }
          } else {
            // Closed period -> Gap of more than 30 days -> Real Baja!
            if (currentPeriod.endContractId) realBajaContractIds.push(currentPeriod.endContractId);
            currentPeriod = { end: c.terminationDate || null, endContractId: c.id };
          }
        }
      }

      // If the last period is closed, the client has left us -> Real Baja
      if (currentPeriod && currentPeriod.end !== null && currentPeriod.endContractId) {
        realBajaContractIds.push(currentPeriod.endContractId);
      }
    });

    // 2. Build whereClause strictly for these real bajas
    let whereClause: any = {
      ...visibilityFilter,
      id: { in: realBajaContractIds }
    };

    if (search) {
      whereClause.OR = [
        { contractCode: { contains: search, mode: 'insensitive' } },
        { supplyPoint: { cups: { contains: search, mode: 'insensitive' } } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (canalFilter !== 'TODOS') {
      whereClause.user = { channelId: canalFilter };
    }

    if (tarifaFilter && tarifaFilter.length > 0) {
      whereClause.supplyPoint = { ...whereClause.supplyPoint, tariff: { in: tarifaFilter } };
    }

    if (origenBajaFilter && origenBajaFilter.length > 0) {
      if (origenBajaFilter.includes('Sin origen')) {
        const otherOrigins = origenBajaFilter.filter(o => o !== 'Sin origen');
        const processOr: any[] = [{ bajaProcess: null }];
        if (otherOrigins.length > 0) {
          processOr.push({ bajaProcess: { in: otherOrigins } });
        }
        whereClause.AND = [
          ...(whereClause.AND || []),
          { OR: processOr }
        ];
      } else {
        whereClause.bajaProcess = { in: origenBajaFilter };
      }
    }

    // --- Helper function to calculate penalty ---
    const calculatePenaltyDetailed = (b: any): { amount: number, dailyConsumption: number, daysRemaining: number } => {
      let pStart = b.permanenceStartDate ? new Date(b.permanenceStartDate) : null;
      const airtable = b.airtableData as any;
      if (!pStart && airtable?.['INICIO_PERMANENCIA']) pStart = new Date(airtable['INICIO_PERMANENCIA']);
      const dAlta = pStart || (b.activationDate ? new Date(b.activationDate) : new Date());
      const bDate = b.terminationDate ? new Date(b.terminationDate) : new Date();
      if (!pStart) pStart = dAlta;

      let pMonths = b.permanenceMonths || parseInt(airtable?.['Meses Permanencia']) || 12;

      const vat = (b.client?.vatNumber || '').toUpperCase().trim();
      const cnae = (b.supplyPoint?.cnae || '').trim();
      const isComunidad = vat.startsWith('H');
      const isFisica = /^[0-9XYZ]/.test(vat);
      const isCnaeHogar = cnae === '9820' || cnae === '9821';

      let isResidencial = false;
      if (isComunidad) isResidencial = true;
      else if (isFisica && isCnaeHogar) isResidencial = true;

      let pEnd = new Date(pStart);
      pEnd.setMonth(pEnd.getMonth() + pMonths);

      let annualCons = b.annualConsumption || b.supplyPoint?.annualConsumption || 0;
      annualCons = annualCons * 1000;
      if (!annualCons && airtable?.['CONSUMO COMISION']) annualCons = parseFloat(airtable['CONSUMO COMISION']) * 1000;
      
      const dailyConsumption = annualCons / 365;
      const daysRemaining = Math.max(0, Math.ceil((pEnd.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24)));
      const expectedEnergyRemaining = dailyConsumption * daysRemaining;

      // If contract terminated after permanence ended, 0 penalty
      if (bDate >= pEnd) return { amount: 0, dailyConsumption, daysRemaining: 0 };
      
      const t = b.supplyPoint?.tariff || '';
      let energyPrice = 0;
      
      const getP = (field: string, airtableField: string) => {
        let val = b[field];
        if (!val && airtable?.[airtableField]) {
          const arr = airtable[airtableField];
          val = Array.isArray(arr) ? parseFloat(arr[0]) : parseFloat(arr);
        }
        return val || 0;
      };

      const p1 = getP('p1e', 'P1E (from PRODUCTOS)');
      const p2 = getP('p2e', 'P2E (from PRODUCTOS)');
      const p3 = getP('p3e', 'P3E (from PRODUCTOS)');
      const p4 = getP('p4e', 'P4E (from PRODUCTOS)');
      const p5 = getP('p5e', 'P5E (from PRODUCTOS)');
      const p6 = getP('p6e', 'P6E (from PRODUCTOS)');

      if (t === '2.0TD' && p1 && p2 && p3) {
        energyPrice = (p1 * 0.25) + (p2 * 0.25) + (p3 * 0.50);
      } else if (t !== '2.0TD' && p1 && p6) {
        energyPrice = (p1 * 0.10) + (p2 * 0.10) + (p3 * 0.10) + (p4 * 0.10) + (p5 * 0.10) + (p6 * 0.50);
      }

      if (!energyPrice || isNaN(energyPrice)) {
        if (t === '2.0TD') energyPrice = 0.16;
        else if (t === '3.0TD') energyPrice = 0.15;
        else if (t.startsWith('6.')) energyPrice = 0.14;
        else energyPrice = isResidencial ? 0.16 : 0.15; 
      }

      let amount = 0;
      if (t.startsWith('6.')) {
        amount = expectedEnergyRemaining * 0.03;
      } else {
        const daysFromStart = Math.ceil((bDate.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24));
        if (isResidencial && daysFromStart <= 14) {
          amount = 0;
        } else {
          amount = expectedEnergyRemaining * energyPrice * 0.05;
        }
      }
      return { amount, dailyConsumption, daysRemaining };
    };

    const calculatePenalty = (b: any): number => calculatePenaltyDetailed(b).amount;
    // ---------------------------------------------

    // Puesto que motivoFilter actual está hardcodeado a "Fin de permanencia", simulamos:
    if (motivoFilter !== 'TODOS') {
      if (motivoFilter !== 'Fin de permanencia') {
        return { success: true, bajas: [], totalCount: 0, totalPenaltySum: 0 };
      }
    }

    if (dateFrom || dateTo) {
      whereClause.terminationDate = {};
      if (dateFrom) whereClause.terminationDate.gte = new Date(dateFrom);
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        whereClause.terminationDate.lte = dTo;
      }
    }

    const totalCount = await prisma.contract.count({ where: whereClause });

    // Sum total penalties for all matching contracts
    const allFilteredForSum = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        permanenceStartDate: true,
        terminationDate: true,
        permanenceMonths: true,
        annualConsumption: true,
        p1e: true,
        airtableData: true,
        calculatedPenalty: true,
        supplyPoint: { select: { tariff: true, annualConsumption: true, cnae: true } },
        client: { select: { vatNumber: true } }
      }
    });

    const totalPenaltySum = allFilteredForSum.reduce((acc, b) => {
      const pen = b.calculatedPenalty !== null ? b.calculatedPenalty : calculatePenalty(b);
      return acc + (Number(pen) || 0);
    }, 0);

    const dbBajas = await prisma.contract.findMany({
      where: whereClause,
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        user: { include: { channel: true } },
        Lead: true
      },
      orderBy: { terminationDate: 'desc' },
      skip: (page - 1) * itemsPerPage,
      take: itemsPerPage
    });

    const bajasData = dbBajas.map((b: any) => {
      const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
      const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
      const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let pStart = b.permanenceStartDate ? new Date(b.permanenceStartDate) : null;
      const airtable = b.airtableData as any;
      if (!pStart && airtable?.['INICIO_PERMANENCIA']) pStart = new Date(airtable['INICIO_PERMANENCIA']);

      const vat = (b.client?.vatNumber || '').toUpperCase().trim();
      const cnae = (b.supplyPoint?.cnae || '').trim();
      const isComunidad = vat.startsWith('H');
      const isFisica = /^[0-9XYZ]/.test(vat);
      const isCnaeHogar = cnae === '9820' || cnae === '9821';
      let isResidencial = false;
      if (isComunidad) isResidencial = true;
      else if (isFisica && isCnaeHogar) isResidencial = true;

      let isPreavisoBreached = false;
      if (!isResidencial && pStart && dBaja) {
        let pMonths = b.permanenceMonths || parseInt(airtable?.['Meses Permanencia']) || 12;
        let currentCycle = 1;
        let thresholdDate = new Date(pStart);
        thresholdDate.setMonth(thresholdDate.getMonth() + (pMonths - 1));

        while (dBaja > thresholdDate) {
          isPreavisoBreached = true;
          currentCycle++;
          thresholdDate = new Date(pStart);
          thresholdDate.setMonth(thresholdDate.getMonth() + (pMonths * currentCycle - 1));
        }
      }

      return {
        id: b.id,
        contractCode: b.contractCode || 'S/N',
        cups: b.supplyPoint?.cups || 'Desconocido',
        cliente: b.client?.businessName || `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() || 'Desconocido',
        clientId: b.clientId,
        telefono: b.client?.contactPhone || null,
        email: b.client?.contactEmail || null,
        tarifa: b.supplyPoint?.tariff || '2.0TD',
        mwh: b.supplyPoint?.annualConsumption || 0,
        fechaAlta: pStart ? pStart.toISOString().split('T')[0] : (b.activationDate?.toISOString().split('T')[0] || '-'),
        fechaBaja: b.terminationDate?.toISOString().split('T')[0] || '-',
        motivo: 'Fin de permanencia', // Airtable no tiene este campo exacto
        canal: b.user?.channel?.name || b.Lead?.source || 'Directo',
        producto: b.product?.name || 'Desconocido',
        diasVida: diffDays,
        hasSelfConsumption: b.supplyPoint?.hasSelfConsumption || false,
        bajaProcess: b.bajaProcess || null,
        calculatedPenalty: b.calculatedPenalty !== null ? b.calculatedPenalty : calculatePenalty(b),
        penalization: b.penalization,
        penaltyStatus: b.penaltyStatus || 'PENDIENTE',
        isPreavisoBreached
      };
    });

    return {
      success: true,
      bajas: bajasData,
      totalCount,
      totalPenaltySum
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getBajasStatsAction() {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    const dbBajas = await prisma.contract.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['BAJA', 'FINALIZADO'] },
        other_Contract: null,
        supplyPoint: {
          contracts: {
            none: {
              status: { in: ['ACTIVO', 'TRAMITANDO', 'VERIFICANDO_FIRMA', 'ACEPTADO'] }
            }
          }
        }
      },
      select: {
        activationDate: true,
        terminationDate: true,
        supplyPointId: true,
        supplyPoint: { select: { annualConsumption: true } }
      }
    });

    const totalCount = dbBajas.length;
    let totalMwhPerdido = 0;
    let totalDiasVidaContrato = 0;
    let bajasEsteMes = 0;

    const now = new Date();
    
    // Agrupar por CUPS para calcular vida real del cliente
    const cupsLifespan: Record<string, { minAlta: Date, maxBaja: Date }> = {};

    for (const b of dbBajas) {
      totalMwhPerdido += b.supplyPoint?.annualConsumption || 0;
      
      const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
      const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
      const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
      totalDiasVidaContrato += Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (b.supplyPointId) {
        if (!cupsLifespan[b.supplyPointId]) {
          cupsLifespan[b.supplyPointId] = { minAlta: dAlta, maxBaja: dBaja };
        } else {
          if (dAlta < cupsLifespan[b.supplyPointId].minAlta) {
            cupsLifespan[b.supplyPointId].minAlta = dAlta;
          }
          if (dBaja > cupsLifespan[b.supplyPointId].maxBaja) {
            cupsLifespan[b.supplyPointId].maxBaja = dBaja;
          }
        }
      }

      if (
        b.terminationDate &&
        b.terminationDate.getMonth() === now.getMonth() &&
        b.terminationDate.getFullYear() === now.getFullYear()
      ) {
        bajasEsteMes++;
      }
    }

    let totalClientDias = 0;
    let cupsCount = 0;
    for (const [, span] of Object.entries(cupsLifespan)) {
      const diffTime = Math.abs(span.maxBaja.getTime() - span.minAlta.getTime());
      totalClientDias += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      cupsCount++;
    }

    const avgDiasContrato = totalCount > 0 ? Math.round(totalDiasVidaContrato / totalCount) : 0;
    const avgDiasCliente = cupsCount > 0 ? Math.round(totalClientDias / cupsCount) : 0;

    return {
      success: true,
      stats: {
        totalBajas: totalCount,
        bajasEsteMes,
        totalMwhPerdido,
        avgDias: avgDiasContrato,
        avgClientDias: avgDiasCliente
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchBajaContext(cups: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('No estás autenticado.');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brand: { include: { company: true } } }
    });

    if (!user?.brand?.company) {
      throw new Error('El usuario no tiene una compañía asociada.');
    }
    const emisora = user.brand.company.codigoRee || '';

    let destino = '';
    if (cups && cups.length >= 6 && cups.startsWith('ES')) {
      const sp = await prisma.supplyPoint.findFirst({
        where: { cups: { startsWith: cups.substring(0, 20) } }
      });
      
      if (sp?.distributorReeCode) {
        destino = sp.distributorReeCode;
      } else {
        destino = cups.substring(2, 6);
      }
    }

    return { success: true, emisora, destino };
  } catch (error: any) {
    console.error('Error fetching context:', error);
    return { success: false, error: error.message };
  }
}

export async function generateBajaXml(data: {
  emisora: string;
  destino: string;
  codigoSolicitud: string;
  cups: string;
  motivo: string;
  fechaPrevista: string;
}) {
  try {
    const { emisora, destino, codigoSolicitud, cups, motivo, fechaPrevista } = data;

    const rootNode = 'MensajeBajaSuspension';
    const now = new Date();
    const formattedDate = now.toISOString().split('.')[0];
    
    // Fetch client to put data in XML
    const sp = await prisma.supplyPoint.findFirst({
      where: { cups: { startsWith: cups.substring(0, 20) } },
      include: {
        contracts: {
          where: { status: { in: ['ACTIVO', 'TRAMITANDO'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { client: true }
        }
      }
    });

    const client = sp?.contracts?.[0]?.client;
    if (!client) {
      throw new Error('No se ha encontrado un cliente activo para este CUPS. Imposible generar el nodo <Cliente>.');
    }

    // Determine type of doc
    let tipoIdentificador = 'NI';
    const vat = client.vatNumber.trim().toUpperCase();
    if (vat.length > 9 && !vat.match(/^[ABCDEFGHJNPQRSUVW]/)) {
      tipoIdentificador = 'PA';
    }

    let tipoPersona = 'F';
    if (vat.match(/^[ABCDEFGHJNPQRSUVW]/)) tipoPersona = 'J';

    let xmlNombre = '';
    if (tipoPersona === 'F') {
      const lastName = client.lastName || '';
      xmlNombre = `<NombrePersona>${client.firstName || '-'}</NombrePersona>
<PrimerApellido>${lastName.split(' ')[0] || '-'}</PrimerApellido>`;
      const segApellido = lastName.split(' ').slice(1).join(' ');
      if (segApellido) {
        xmlNombre += `\n<SegundoApellido>${segApellido}</SegundoApellido>`;
      }
    } else {
      xmlNombre = `<RazonSocial>${client.businessName}</RazonSocial>`;
    }

    let telefonoXml = '';
    if (client.contactPhone) {
      const phone = client.contactPhone.replace(/\D/g, '').slice(-9);
      if (phone.length === 9) {
        telefonoXml = `
<Telefono>
  <PrefijoPais>34</PrefijoPais>
  <Numero>${phone}</Numero>
</Telefono>`;
      }
    }

    const xml = `<${rootNode} xmlns="http://localhost/elegibilidad">
<Cabecera>
  <CodigoREEEmpresaEmisora>${emisora}</CodigoREEEmpresaEmisora>
  <CodigoREEEmpresaDestino>${destino}</CodigoREEEmpresaDestino>
  <CodigoDelProceso>B1</CodigoDelProceso>
  <CodigoDePaso>01</CodigoDePaso>
  <CodigoDeSolicitud>${codigoSolicitud}</CodigoDeSolicitud>
  <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
  <FechaSolicitud>${formattedDate}</FechaSolicitud>
  <CUPS>${cups}</CUPS>
</Cabecera>
<BajaSuspension>
  <DatosSolicitud>
    <IndActivacion>A</IndActivacion>${fechaPrevista ? `
    <FechaPrevistaAccion>${fechaPrevista}</FechaPrevistaAccion>` : ''}
    <Motivo>${motivo}</Motivo>
  </DatosSolicitud>
  <Cliente>
    <IdCliente>
      <TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
      <Identificador>${vat}</Identificador>
    </IdCliente>
    <Nombre>
      ${xmlNombre}
    </Nombre>${telefonoXml}
  </Cliente>
</BajaSuspension>
</${rootNode}>`;

    return { success: true, xml };
  } catch (error: any) {
    console.error('Error generando XML de baja:', error);
    return { success: false, error: error.message };
  }
}

import { renderToStream } from '@react-pdf/renderer';
import { PenaltyInvoicePDF } from '@/components/pdf/PenaltyInvoicePDF';
import { uploadFileToR2 } from '@/lib/r2';
import React from 'react';

export async function savePenaltyAction(contractId: string, penalization: number, status: string, generatePdf: boolean = true) {
  try {
    const visibilityFilter = await getUserVisibilityFilter();
    
    // Check permission/existence and include relations needed for PDF
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        ...visibilityFilter
      },
      include: {
        client: true,
        supplyPoint: true,
        brand: {
          include: { company: true }
        },
      }
    });

    if (!contract || !contract.brand || !contract.client || !contract.supplyPoint) {
      return { success: false, error: 'Contract not found or access denied' };
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        penalization,
        penaltyStatus: status
      }
    });

    // If status is FACTURADA, generate the PDF and the PenaltyInvoice record
    if (status === 'FACTURADA' && penalization > 0 && generatePdf) {
      // 1. Generate Invoice Number
      const year = new Date().getFullYear().toString().slice(-2);
      // Find all penalty invoices for this year to get next number
      const allInvoices = await prisma.penaltyInvoice.findMany({
        where: { invoiceNumber: { startsWith: `A${year}PEN` } },
        select: { invoiceNumber: true }
      });
      
      let nextNum = 1;
      const nums = allInvoices.map(inv => {
        const match = inv.invoiceNumber.match(/PEN(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      
      if (nums.length > 0) {
        nextNum = Math.max(...nums) + 1;
      }
      
      const invoiceNumber = `A${year}PEN${nextNum.toString().padStart(3, '0')}`;
      
      // Calculate daily consumption and days remaining for the PDF
      let annualCons = contract.annualConsumption || contract.supplyPoint?.annualConsumption || 0;
      annualCons = annualCons * 1000;
      const dailyConsumption = annualCons / 365;
      
      let pStart = contract.permanenceStartDate || contract.activationDate || new Date();
      let pMonths = contract.permanenceMonths || 12;
      let bDate = contract.terminationDate || new Date();
      let pEnd = new Date(pStart);
      pEnd.setMonth(pEnd.getMonth() + pMonths);
      
      const vat = (contract.client?.vatNumber || '').toUpperCase().trim();
      const cnae = (contract.supplyPoint?.cnae || '').trim();
      let isResidencial = vat.startsWith('H') || (/^[0-9XYZ]/.test(vat) && (cnae === '9820' || cnae === '9821'));
      
      const daysRemaining = Math.max(0, Math.ceil((pEnd.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24)));

      // 2. Prepare Data
      const baseAmount = penalization;
      const taxAmount = baseAmount * 0.21;
      const totalAmount = baseAmount + taxAmount;
      const issueDate = new Date().toLocaleDateString('es-ES');
      
      const pdfData = {
        invoiceNumber,
        issueDate,
        baseAmount,
        taxAmount,
        totalAmount,
        brandName: contract.brand.company.name || contract.brand.name,
        brandVat: contract.brand.company.cif || '',
        brandAddress: contract.brand.company.address || contract.brand.address || '',
        brandLogo: contract.brand.invoiceLogoUrl || contract.brand.logoUrl || null,
        clientName: contract.client.businessName,
        clientVat: contract.client.vatNumber,
        clientAddress: contract.client.billingAddress || contract.supplyPoint.address,
        clientCity: contract.client.billingCity || contract.supplyPoint.city,
        clientPostalCode: contract.client.billingPostalCode || contract.supplyPoint.postalCode,
        cups: contract.supplyPoint.cups,
        dailyConsumption,
        daysRemaining,
        banks: [
          { name: contract.brand.bankName1, iban: contract.brand.bankIban1 },
          { name: contract.brand.bankName2, iban: contract.brand.bankIban2 },
          { name: contract.brand.bankName3, iban: contract.brand.bankIban3 }
        ].filter(b => b.name && b.iban)
      };

      // 3. Generate PDF
      const stream = await renderToStream(<PenaltyInvoicePDF data={pdfData} />);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // 4. Upload to R2
      const fileName = `penalizaciones/${new Date().getFullYear()}/${invoiceNumber}.pdf`;
      const pdfUrl = await uploadFileToR2(fileName, pdfBuffer, 'application/pdf');

      // 5. Save to DB
      await prisma.penaltyInvoice.create({
        data: {
          invoiceNumber,
          amount: totalAmount,
          pdfUrl,
          contractId: contract.id,
          clientId: contract.client.id,
          supplyPointId: contract.supplyPoint.id,
          status: 'EMITIDA'
        }
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error saving penalty:", error);
    return { success: false, error: error.message };
  }
}
