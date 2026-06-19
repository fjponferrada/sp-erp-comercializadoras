import { NextResponse } from 'next/server';
import { AggregationService } from '@/lib/services/AggregationService';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 60; // Default a 60 días para Vercel
    
    if (isNaN(days) || days <= 0) {
      return NextResponse.json({ error: 'Parámetro days inválido' }, { status: 400 });
    }

    console.log(`API Sincronización Histórico llamada. Días: ${days}`);
    const rows = await AggregationService.regenerateAggregates(days);

    return NextResponse.json({ success: true, rowsInserted: rows, daysProcessed: days });
  } catch (error: any) {
    console.error('Error en aggregate-history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
