import { NextResponse } from 'next/server';
import { AggregationService } from '@/lib/services/AggregationService';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 60; // Default a 60 días para Vercel
    
    if (isNaN(days) || days <= 0) {
      return NextResponse.json({ error: 'Parámetro days inválido' }, { status: 400 });
    }

    const session = await auth();
    const cronSecret = searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET || 'fallback_secret';
    
    let targetCompanyId: string | undefined = undefined;

    if (cronSecret === expectedSecret || authHeader === `Bearer ${expectedSecret}`) {
      // Si se ejecuta por CRON, no enviamos targetCompanyId para que regenere todas
      targetCompanyId = undefined;
    } else {
      // Si se ejecuta manual, exigimos sesión
      if (!session?.user?.companyId) {
        return NextResponse.json({ error: 'Unauthorized: No session or companyId' }, { status: 401 });
      }
      targetCompanyId = session.user.companyId;
    }

    console.log(`API Sincronización Histórico llamada. Días: ${days}, CompanyId: ${targetCompanyId || 'ALL'}`);
    const rows = await AggregationService.regenerateAggregates(days, targetCompanyId);

    return NextResponse.json({ success: true, rowsInserted: rows, daysProcessed: days });
  } catch (error: any) {
    console.error('Error en aggregate-history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
