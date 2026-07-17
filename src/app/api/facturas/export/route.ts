import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import * as xlsx from 'xlsx';
import { auth } from '@/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || '';
    const filterType = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';

    const visibilityFilter = await getInvoiceVisibilityFilter();
    const whereClause: any = { ...visibilityFilter };

    if (filterType) {
      whereClause.invoiceType = filterType;
    }

    if (status === 'communicated') {
      whereClause.communicatedAt = { not: null };
    } else if (status === 'pending') {
      whereClause.communicatedAt = null;
    }

    if (dateFrom || dateTo) {
      whereClause.issueDate = {};
      if (dateFrom) {
        whereClause.issueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        whereClause.issueDate.lte = endOfDay;
      }
    }

    if (searchTerm) {
      whereClause.OR = [
        { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
        { client: { businessName: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: searchTerm, mode: 'insensitive' } } },
        { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } },
        { invoiceData: { path: ['NOMBRE/RAZON SOCIAL'], string_contains: searchTerm } },
        { invoiceData: { path: ['NIF/CIF'], string_contains: searchTerm } },
        { invoiceData: { path: ['CUPS'], string_contains: searchTerm } },
      ];
    }

    const invoicesRaw = await prisma.invoice.findMany({
      where: whereClause,
      include: { client: true, contract: true, supplyPoint: true },
      orderBy: [
        { issueDate: 'desc' },
        { invoiceNumber: 'desc' }
      ]
    });

    const rows = invoicesRaw.map(inv => {
      const d: any = inv.invoiceData || {};
      const clientName = d['NOMBRE/RAZON SOCIAL'] || inv.client?.businessName || (inv.client ? `${inv.client.firstName || ''} ${inv.client.lastName || ''}`.trim() : '');
      const cif = d['CIF'] || d['NIF/CIF'] || inv.client?.vatNumber || '';
      
      const formatDateES = (date: Date | null | undefined) => {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const parsed = parseFloat(String(val).replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
      };

      const row = [
        inv.invoiceNumber,
        inv.contract?.contractCode || '',
        d['Numero factura rectificada'] || '',
        clientName,
        cif,
        inv.supplyPoint?.cups || d['CUPS'] || '',
        inv.invoiceType || 'Normal',
        formatDateES(inv.issueDate),
        d['Procedencia Desde'] || '',
        d['Procedencia Hasta'] || inv.origin || '',
        formatDateES(inv.billingStart),
        formatDateES(inv.billingEnd),
        parseNum(d['Dias'] || d['Numero Dias Alquiler 1'] || 0),
        parseNum(d['P1 Potencia Contratada']),
        parseNum(d['P2 Potencia Contratada']),
        parseNum(d['P3 Potencia Contratada']),
        parseNum(d['P4 Potencia Contratada']),
        parseNum(d['P5 Potencia Contratada']),
        parseNum(d['P6 Potencia Contratada']),
        parseNum(d['P1 Potencia Max Demanda']),
        parseNum(d['P2 Potencia Max Demanda']),
        parseNum(d['P3 Potencia Max Demanda']),
        parseNum(d['P4 Potencia Max Demanda']),
        parseNum(d['P5 Potencia Max Demanda']),
        parseNum(d['P6 Potencia Max Demanda']),
        parseNum(d['P1 Energia Activa Consumida']),
        parseNum(d['P2 Energia Activa Consumida']),
        parseNum(d['P3 Energia Activa Consumida']),
        parseNum(d['P4 Energia Activa Consumida']),
        parseNum(d['P5 Energia Activa Consumida']),
        parseNum(d['P6 Energia Activa Consumida']),
        parseNum(d['Energía Total Consumida']),
        parseNum(d['P1 Energia Reactiva Consumida']),
        parseNum(d['P2 Energia Reactiva Consumida']),
        parseNum(d['P3 Energia Reactiva Consumida']),
        parseNum(d['P4 Energia Reactiva Consumida']),
        parseNum(d['P5 Energia Reactiva Consumida']),
        parseNum(d['P6 Energia Reactiva Consumida']),
        parseNum(d['Reactiva Total Consumida']),
        parseNum(d['Importe Ponderado ATR Potencia P1']),
        parseNum(d['Importe Ponderado ATR Potencia P2']),
        parseNum(d['Importe Ponderado ATR Potencia P3']),
        parseNum(d['Importe Ponderado ATR Potencia P4']),
        parseNum(d['Importe Ponderado ATR Potencia P5']),
        parseNum(d['Importe Ponderado ATR Potencia P6']),
        parseNum(d['Importe Ponderado ATR Energia P1']),
        parseNum(d['Importe Ponderado ATR Energia P2']),
        parseNum(d['Importe Ponderado ATR Energia P3']),
        parseNum(d['Importe Ponderado ATR Energia P4']),
        parseNum(d['Importe Ponderado ATR Energia P5']),
        parseNum(d['Importe Ponderado ATR Energia P6']),
        parseNum(d['Importe Potencia Factura']),
        parseNum(d['Importe Energia Factura']),
        parseNum(d['Importe Total R ATR']),
        parseNum(d['Importe Ajuste Gas']),
        parseNum(d['Importe Total Excesos ATR']),
        parseNum(d['Importe Impuesto'] || d['Base Imponible Tasa Municipal']),
        parseNum(d['Importe Bono Social']),
        parseNum(d['Alquiler Equipo de Medida']),
        parseNum(d['Subtotal 2']),
        parseNum(d['Subtotal Otros Concepto']),
        parseNum(d['Base Imponible 0']),
        parseNum(d['Base Imponible 21']),
        parseNum(d['Importe IVA']),
        inv.totalAmount || parseNum(d['Total'])
      ];

      // Invertir valores para facturas de Abono desde la columna M (índice 12)
      if (inv.invoiceType?.toLowerCase().includes('abono')) {
        for (let i = 12; i < row.length; i++) {
          if (typeof row[i] === 'number' && row[i] !== 0) {
            row[i] = -Math.abs(row[i] as number);
          }
        }
      }

      return row;
    });

    const headers = [
      'Numero Factura', 'Contrato', 'Numero factura rectificada', 'NOMBRE/RAZON SOCIAL',
      'CIF', 'CUPS', 'Tipo Factura', 'Fecha Factura', 'Procedencia Desde', 'Procedencia Hasta',
      'Desde', 'Hasta', 'Dias', 'P1C', 'P2C', 'P3C', 'P4C', 'P5C', 'P6C',
      'P1 Potencia Max Demanda', 'P2 Potencia Max Demanda', 'P3 Potencia Max Demanda',
      'P4 Potencia Max Demanda', 'P5 Potencia Max Demanda', 'P6 Potencia Max Demanda',
      'P1 Energia Activa Consumida', 'P2 Energia Activa Consumida', 'P3 Energia Activa Consumida',
      'P4 Energia Activa Consumida', 'P5 Energia Activa Consumida', 'P6 Energia Activa Consumida',
      'Energía Total Consumida', 'P1 Energia Reactiva Consumida', 'P2 Energia Reactiva Consumida',
      'P3 Energia Reactiva Consumida', 'P4 Energia Reactiva Consumida', 'P5 Energia Reactiva Consumida',
      'P6 Energia Reactiva Consumida', 'Reactiva Total Consumida', 'Importe Ponderado ATR Potencia P1',
      'Importe Ponderado ATR Potencia P2', 'Importe Ponderado ATR Potencia P3', 'Importe Ponderado ATR Potencia P4',
      'Importe Ponderado ATR Potencia P5', 'Importe Ponderado ATR Potencia P6', 'Importe Ponderado ATR Energia P1',
      'Importe Ponderado ATR Energia P2', 'Importe Ponderado ATR Energia P3', 'Importe Ponderado ATR Energia P4',
      'Importe Ponderado ATR Energia P5', 'Importe Ponderado ATR Energia P6', 'Importe Potencia Factura',
      'Importe Energia Factura', 'Importe Total R ATR', 'Importe Ajuste Gas', 'Importe Total Excesos ATR',
      'Importe Impuesto', 'Importe Bono Social', 'Alquiler Equipo de Medida', 'Subtotal 2',
      'Subtotal Otros Concepto', 'Base Imponible 0', 'Base Imponible 21', 'Importe IVA', 'Total'
    ];

    const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Facturas");
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="export_facturas.xlsx"',
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
