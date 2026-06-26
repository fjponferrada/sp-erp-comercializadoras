import { NextResponse } from 'next/server';
import { CompodemService } from '@/lib/services/CompodemService';

export async function POST(req: Request) {
  try {
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

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en importación COMPODEM:', error);
    return NextResponse.json({ error: 'Error procesando el fichero ZIP: ' + error.message }, { status: 500 });
  }
}
