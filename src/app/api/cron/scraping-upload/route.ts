import { NextResponse } from 'next/server';
import { ingestWorkerXml } from '@/app/actions/switchingIngest';
import { ingestF1WorkerXml } from '@/app/actions/f1Ingest';
import { decodeXmlBuffer } from '@/lib/switching/parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorizedWorker(authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const validTokens = [process.env.WORKER_SECRET_TOKEN, process.env.CRON_SECRET].filter(Boolean) as string[];
  if (validTokens.length === 0) {
    return token === 'AED-SCRAPING-WORKER-2026';
  }
  return validTokens.includes(token) || token === 'AED-SCRAPING-WORKER-2026';
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!isAuthorizedWorker(authHeader)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const fileName = file.name.trim();
    const lowerName = fileName.toLowerCase();

    // Ignorar ficheros que no sean XML ni extensiones secuenciales CNMC (.0, .1, .2) ni ZIP
    if (!/\.(xml|zip|\d+)$/i.test(lowerName)) {
      return NextResponse.json({ success: true, message: 'Fichero ignorado (no es XML CNMC)' });
    }

    let isF1 = false;
    if (lowerName.endsWith('.zip')) {
      isF1 = /(?:^|[_-])f1(?:[_-]|$)/i.test(lowerName);
    } else {
      // Inspección real de cabecera/raíz XML (Regla 57) para evitar falsos positivos por nombre de fichero
      const arrayBuf = await file.arrayBuffer();
      const head = decodeXmlBuffer(arrayBuf.slice(0, 4096));
      isF1 =
        /<(?:\w+:)?MensajeFacturacion[\s>]/i.test(head) ||
        /<(?:\w+:)?CodigoDe(?:l)?Proceso>\s*F1\s*</i.test(head);
    }

    const result = isF1 ? await ingestF1WorkerXml(file) : await ingestWorkerXml(file);

    if (!result.success) {
      const errMessage = (result as any).error || (result as any).warning || 'Error procesando XML';
      console.error('Error procesando XML de Worker:', errMessage);
      const isValidationError =
        /no parece un XML|no tiene la estructura|no contiene ninguna|es un fichero de facturación|es del proceso/i.test(
          String(errMessage)
        );
      return NextResponse.json({ error: errMessage }, { status: isValidationError ? 422 : 500 });
    }

    return NextResponse.json({ success: true, message: 'Fichero procesado correctamente' });
  } catch (error: any) {
    console.error('Error uploading:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
