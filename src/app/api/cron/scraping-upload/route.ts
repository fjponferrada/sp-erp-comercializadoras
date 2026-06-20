import { NextResponse } from 'next/server';
import { ingestWorkerXml } from '@/app/actions/switchingIngest';
import { ingestF1WorkerXml } from '@/app/actions/f1Ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const WORKER_TOKEN = process.env.WORKER_SECRET_TOKEN || 'AED-SCRAPING-WORKER-2026';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${WORKER_TOKEN}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    
    // Ignorar ficheros que no sean XML
    if (!fileName.endsWith('.xml')) {
      return NextResponse.json({ success: true, message: 'Fichero ignorado (no es XML)' });
    }

    let result;

    // Enrutar a F1 o a Switching
    if (fileName.includes('_f1_') || fileName.startsWith('f1_') || fileName.includes('f1')) {
      result = await ingestF1WorkerXml(file);
    } else {
      // Todo el resto de XMLs van al importador de switching
      result = await ingestWorkerXml(file);
    }

    if (!result.success) {
      console.error('Error procesando XML de Worker:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Fichero procesado correctamente' });
  } catch (error: any) {
    console.error('Error uploading:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
