import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { isRecognizedCchFilename, processCchBuffer } from '@/lib/services/cchParser';
import { AggregationService } from '@/lib/services/AggregationService';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha proporcionado ningún fichero' }, { status: 400 });
    }

    if (!isRecognizedCchFilename(file.name, true)) {
      return NextResponse.json(
        { error: 'Fichero no reconocido. Sube archivos ZIP, CSV, GZ, BZ2, XLSX o ficheros CNMC (F1, F5D, P1D, P2D...).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sourceTag = file.name.toLowerCase().endsWith('.zip') ? 'UPLOAD_ZIP' : 'UPLOAD_CSV';

    const results = await processCchBuffer(buffer, file.name, sourceTag, true);

    const uniqueDates = Array.from(new Set(results.affectedDates || [])).sort();

    if (uniqueDates.length > 0) {
      try {
        const companyId = await resolveActiveCompanyId(session);
        await AggregationService.regenerateForDates(uniqueDates, companyId || undefined);
        const affectedMonths = Array.from(new Set(uniqueDates.map(d => d.slice(0, 7)))).sort();
        await runCalculatePendingEnergy(undefined, companyId || undefined, {
          targetMonths: affectedMonths,
        });
        revalidatePath('/gestion/energia-pendiente');
      } catch (syncErr) {
        console.error('Aviso: error sincronizando agregados CCH / energía pendiente tras subida CCH:', syncErr);
      }
    }

    return NextResponse.json({ message: 'Procesamiento completado', results });
  } catch (error: any) {
    console.error('ETL Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
