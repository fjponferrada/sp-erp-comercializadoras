import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// Helper to safely parse numbers
const parseNum = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Helper to normalize strings (remove accents and uppercase)
const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const municipalityName = searchParams.get('postalCode'); // Used as municipality name from dropdown

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const session = await auth();
    if (!session || !session.user || !session.user.brandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const brandId = session.user.brandId;

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);

    let invoices: any[] = [];

    // OPTIMIZATION: If a specific municipality is requested, pre-filter SupplyPoints 
    // to avoid fetching hundreds of thousands of invoices into memory and timing out on Vercel.
    if (municipalityName) {
      // Split ' -- PROVINCE' off if it exists to get just the city name
      const cleanMunicipalityName = municipalityName.includes(' -- ') ? municipalityName.split(' -- ')[0] : municipalityName;
      const searchCity = normalizeString(cleanMunicipalityName);
      
      const sps = await prisma.supplyPoint.findMany({
        where: { client: { brandId } },
        select: { id: true, city: true }
      });

      const matchingSpIds = sps.filter(sp => {
        const city = normalizeString(sp.city);
        if (!city) return false;
        
        // Exact match or substring match (e.g. "L'HOSPITALET DE L'INFANT" inside "VANDELLOS I L'HOSPITALET DE L'INFANT")
        if (city === searchCity || searchCity.includes(city) || city.includes(searchCity)) return true;
        
        return false;
      }).map(sp => sp.id);

      invoices = await prisma.invoice.findMany({
        where: {
          client: { brandId },
          issueDate: { gte: startDate, lte: endDate },
          supplyPointId: { in: matchingSpIds }
        },
        select: {
          id: true, pdfUrl: true, issueDate: true, billingStart: true, billingEnd: true,
          invoiceNumber: true, invoiceType: true, taxAmount: true, totalMWh: true,
          subtotal1: true, invoiceData: true,
          client: { select: { vatNumber: true } },
          supplyPoint: {
            select: { cups: true, city: true, tariff: true, postalCode: true, distributor: true, distributorName: true }
          }
        },
        orderBy: { issueDate: 'asc' }
      });
    } else {
      // If "Todos los ayuntamientos" is selected, we must fetch everything in the date range
      invoices = await prisma.invoice.findMany({
        where: {
          client: { brandId },
          issueDate: { gte: startDate, lte: endDate },
        },
        select: {
          id: true, pdfUrl: true, issueDate: true, billingStart: true, billingEnd: true,
          invoiceNumber: true, invoiceType: true, taxAmount: true, totalMWh: true,
          subtotal1: true, invoiceData: true,
          client: { select: { vatNumber: true } },
          supplyPoint: {
            select: { cups: true, city: true, tariff: true, postalCode: true, distributor: true, distributorName: true }
          }
        },
        orderBy: { issueDate: 'asc' }
      });
    }

    let totalBaseGlobal = 0;
    let totalTasaGlobal = 0;
    
    // Filter invoices in memory to allow accent-insensitive matching
    let filteredInvoices = invoices;
    if (municipalityName) {
      const cleanMunicipalityName = municipalityName.includes(' -- ') ? municipalityName.split(' -- ')[0] : municipalityName;
      const searchCity = normalizeString(cleanMunicipalityName);
      
      filteredInvoices = invoices.filter(inv => {
        const data = inv.invoiceData as Record<string, any> | null;
        const rawCity = inv.supplyPoint?.city || (data ? (data['POBLACION PS'] || data['Poblacion PS'] || data['Población PS']) : null);
        const city = normalizeString(rawCity as string);
        if (!city) return false;
        
        if (city === searchCity || searchCity.includes(city) || city.includes(searchCity)) return true;
        
        return false;
      });
    }

    if (municipalityName) {
      // Detailed view for a single municipality
      const detailedResults = filteredInvoices.map(inv => {
        const data = inv.invoiceData as Record<string, any> | null;
        
        const isAbono = (inv.invoiceType || data?.['Tipo Factura'])?.toLowerCase().includes('abono');
        
        let baseIVA = parseNum(data?.['Base Imponible IVA']);
        let bonoSocial = parseNum(data?.['Importe Bono Social']);
        let impuestoElectrico = parseNum(inv.taxAmount) || parseNum(data?.['Importe Impuesto CORR']) || parseNum(data?.['Importe Impuesto']);
        let baseF1 = parseNum(data?.['BaseImponibleF1 CORR']) || parseNum(data?.['BaseImponibleF1']);
        let energiaConsumida = parseNum(inv.totalMWh);
        let baseImponibleFactura = parseNum(data?.['BI Subtotal 1 CORR']) || parseNum(inv.subtotal1);

        if (isAbono) {
          if (baseIVA > 0) baseIVA = -baseIVA;
          if (bonoSocial > 0) bonoSocial = -bonoSocial;
          if (impuestoElectrico > 0) impuestoElectrico = -impuestoElectrico;
          if (baseF1 > 0) baseF1 = -baseF1;
          if (energiaConsumida > 0) energiaConsumida = -energiaConsumida;
          if (baseImponibleFactura > 0) baseImponibleFactura = -baseImponibleFactura;
        }

        let baseTasaMunicipal = baseIVA - bonoSocial - impuestoElectrico - baseF1;
        const tasaMunicipal = Math.round((baseTasaMunicipal * 0.015) * 100) / 100;
        
        totalBaseGlobal += baseTasaMunicipal;
        totalTasaGlobal += tasaMunicipal;

        return {
          id: inv.id,
          pdfUrl: inv.pdfUrl,
          issueDate: inv.issueDate,
          billingStart: inv.billingStart,
          billingEnd: inv.billingEnd,
          cups: inv.supplyPoint?.cups || '',
          distribuidora: inv.supplyPoint?.distributorName || inv.supplyPoint?.distributor || '',
          nifCliente: inv.client?.vatNumber || '',
          invoiceNumber: inv.invoiceNumber,
          codigoFiscal: data?.['Codigo Fiscal'] || '',
          invoiceType: inv.invoiceType || 'Normal',
          tariff: inv.supplyPoint?.tariff || '',
          postalCode: (data?.['CP PS'] as string) || inv.supplyPoint?.postalCode || '',
          energiaConsumida,
          importeIVA: baseIVA,
          baseImponibleFactura,
          baseImponibleF1: baseF1,
          importeImpuesto: impuestoElectrico,
          importeBonoSocial: bonoSocial,
          baseImponibleTasaMunicipal: baseTasaMunicipal,
          tasaMunicipal: tasaMunicipal
        };
      });

      return NextResponse.json({
        type: 'detailed',
        results: detailedResults,
        totalBaseGlobal,
        totalTasaGlobal
      });

    } else {
      // Grouped view for all municipalities
      const groupedMap = new Map<string, { cp: string, poblacion: string, base: number, tasa: number }>();

      for (const inv of filteredInvoices) {
        const data = inv.invoiceData as Record<string, any> | null;
        const sp = inv.supplyPoint;
        
        const cp = (data?.['CP PS'] as string) || sp?.postalCode || 'Desconocido';
        const rawCityFromData = data ? (data['POBLACION PS'] || data['Poblacion PS'] || data['Población PS']) : null;
        const rawPoblacion = sp?.city || (rawCityFromData as string) || 'Desconocido';
        
        // Agrupamos por nombre de ciudad normalizado para unir Bétera y BETERA
        const normalizedCity = normalizeString(rawPoblacion) || 'DESCONOCIDO';
        const groupKey = normalizedCity;

        const isAbono = (inv.invoiceType || data?.['Tipo Factura'])?.toLowerCase().includes('abono');
        
        let baseIVA = parseNum(data?.['Base Imponible IVA']);
        let bonoSocial = parseNum(data?.['Importe Bono Social']);
        let impuestoElectrico = parseNum(inv.taxAmount) || parseNum(data?.['Importe Impuesto CORR']) || parseNum(data?.['Importe Impuesto']);
        let baseF1 = parseNum(data?.['BaseImponibleF1 CORR']) || parseNum(data?.['BaseImponibleF1']);

        if (isAbono) {
          if (baseIVA > 0) baseIVA = -baseIVA;
          if (bonoSocial > 0) bonoSocial = -bonoSocial;
          if (impuestoElectrico > 0) impuestoElectrico = -impuestoElectrico;
          if (baseF1 > 0) baseF1 = -baseF1;
        }
        
        let baseTasaMunicipal = baseIVA - bonoSocial - impuestoElectrico - baseF1;
        const tasaMunicipal = Math.round((baseTasaMunicipal * 0.015) * 100) / 100;

        if (!groupedMap.has(groupKey)) {
          groupedMap.set(groupKey, {
            cp: cp, // Mostramos el primer CP que encontremos para este municipio
            poblacion: rawPoblacion.toUpperCase(),
            base: 0,
            tasa: 0
          });
        }
        
        const group = groupedMap.get(groupKey)!;
        group.base += baseTasaMunicipal;
        group.tasa += tasaMunicipal;
        
        totalBaseGlobal += baseTasaMunicipal;
        totalTasaGlobal += tasaMunicipal;
      }

      const groupedResults = Array.from(groupedMap.values()).sort((a, b) => a.poblacion.localeCompare(b.poblacion));

      return NextResponse.json({
        type: 'grouped',
        results: groupedResults,
        totalBaseGlobal,
        totalTasaGlobal
      });
    }

  } catch (error) {
    console.error('Error calculating Tasa Municipal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
