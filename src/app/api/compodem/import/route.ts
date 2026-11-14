import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { CompodemService } from '@/lib/services/CompodemService';
import { isComprasAuthorized } from '@/lib/reganecuServer';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!isComprasAuthorized(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha adjuntado ningún fichero ZIP.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'El fichero debe ser un .zip' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await CompodemService.processZipBuffer(buffer);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (result.affectedMonths && result.affectedMonths.length > 0) {
      try {
        await runCalculatePendingEnergy(undefined, undefined, { targetMonths: result.affectedMonths });
      } catch (syncErr) {
        console.error('Aviso: error recalculando energía pendiente tras importar COMPODEM:', syncErr);
      }
    }

    revalidatePath('/compras/importar-compodem');
    revalidatePath('/compras/precios-componentes');
    revalidatePath('/gestion/energia-pendiente');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en importación COMPODEM:', error);
    return NextResponse.json({ error: 'Error procesando el fichero ZIP: ' + error.message }, { status: 500 });
  }
}
