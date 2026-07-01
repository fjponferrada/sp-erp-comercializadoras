import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Run async in background without blocking
    runCalculatePendingEnergy().catch(err => console.error('Error in background runCalculatePendingEnergy:', err));

    return NextResponse.json({ success: true, message: 'Cálculo iniciado en segundo plano. Los resultados se actualizarán en unos minutos.' });
  } catch (error: any) {
    console.error('Error trigger calculate_pending_energy:', error);
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
  }
}
