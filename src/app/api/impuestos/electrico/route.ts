import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.brandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandId = session.user.brandId;
    const url = new URL(req.url);
    const yearStr = url.searchParams.get('year');
    const quarterStr = url.searchParams.get('quarter');

    if (!yearStr || !quarterStr) {
      return NextResponse.json({ error: 'Falta year o quarter' }, { status: 400 });
    }

    const year = parseInt(yearStr);
    const quarter = parseInt(quarterStr);

    let startDate: Date;
    let endDate: Date;

    if (quarter === 1) {
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));
    } else if (quarter === 2) {
      startDate = new Date(Date.UTC(year, 3, 1));
      endDate = new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999));
    } else if (quarter === 3) {
      startDate = new Date(Date.UTC(year, 6, 1));
      endDate = new Date(Date.UTC(year, 8, 30, 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(year, 9, 1));
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        client: { brandId },
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        supplyPoint: true,
      },
    });

    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;

    // Agrupar por Zona y Tipo
    const resultsMap = new Map<string, any>();
    const seenInvoices = new Set<string>();

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }

      const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
      const data = inv.invoiceData as any;

      // Extract fields from Airtable JSON (exact CSV headers)
      // The user explicitly confirmed that the CSV column they use for the base is "Subtotal 1"
      let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
      let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
      let energy = data ? parseNum(data['Energía Total Consumida']) : 0;
      if (energy) energy = energy / 1000;

      // EXTREMELY IMPORTANT: If the invoice has 0 tax, it shouldn't contribute to the tax bases!
      if (taxAmount === 0) continue;

      // Apply sign ONLY if the amount is positive and it's an Abono.
      if (isAbono) {
        if (subtotal > 0) subtotal = -subtotal;
        if (taxAmount > 0) taxAmount = -taxAmount;
        if (energy > 0) energy = -energy;
      }

      // Check if it reached the minimum
      let isMinApplied = false;
      const minSuperadoValue = data ? (data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado) : undefined;
      
      if (minSuperadoValue !== undefined && String(minSuperadoValue).trim() !== '') {
         const flag = String(minSuperadoValue).trim().toLowerCase();
         // If "Superado" is false or 0, it means the minimum was applied.
         isMinApplied = flag === '0' || flag === 'false';
      } else {
         if (energy !== 0) {
            const ratio = Math.abs(taxAmount / energy);
            // Common minimums are 0.5 or 1.0. We use a threshold.
            if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 1.0) < 0.05) {
               isMinApplied = true;
            }
         }
      }

      // Identify zone
      const prov = (inv.supplyPoint?.province || '').toLowerCase();
      let zona = 'España';
      if (prov.includes('navarra')) zona = 'Navarra';
      else if (prov.includes('alava') || prov.includes('álava')) zona = 'Álava';
      else if (prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) zona = 'Guipúzcoa';
      else if (prov.includes('vizcaya') || prov.includes('bizkaia')) zona = 'Vizcaya';

      let taxPct = data?.['Impuesto (%)'] ? parseNum(data['Impuesto (%)']) : (inv.taxPercentage || 5.11);
      
      // Some percentages may be formatted strangely or exact floating points
      // Let's normalize it to 2 decimal places for grouping
      taxPct = Math.round(taxPct * 100) / 100;

      // If minimum is applied, the theoretical percentage doesn't matter for grouping
      if (isMinApplied) {
         taxPct = 0;
      }

      const key = `${zona}_${taxPct}_${isMinApplied}`;

      if (!resultsMap.has(key)) {
        resultsMap.set(key, {
          zona,
          tipo: taxPct,
          baseSujeta: 0,
          impuestoBase: 0,
          consumoMinimo: 0,
          impuestoMinimo: 0,
          total: 0,
          isMinApplied
        });
      }

      const row = resultsMap.get(key);
      if (isMinApplied) {
        row.consumoMinimo += energy;
        row.impuestoMinimo += taxAmount;
      } else {
        row.baseSujeta += subtotal;
        row.impuestoBase += taxAmount;
      }
      row.total += taxAmount;
    }

    const finalResults = Array.from(resultsMap.values());
    
    // Sort logic: España first, then alphabetical. Then by tax descending.
    finalResults.sort((a, b) => {
      if (a.zona === 'España' && b.zona !== 'España') return -1;
      if (b.zona === 'España' && a.zona !== 'España') return 1;
      if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
      return b.tipo - a.tipo;
    });

    return NextResponse.json({ results: finalResults });
  } catch (error: any) {
    console.error('Error calculando IE:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
