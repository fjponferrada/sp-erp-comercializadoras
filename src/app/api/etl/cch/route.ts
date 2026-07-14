import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import JSZip from 'jszip';
import { processCchCsv } from '@/lib/services/cchParser';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    let results = { success: 0, skipped: 0, errors: 0 };

    const PRIORIDAD_MAP = ['F1', 'C1', 'Q1', 'F1H', 'F1QH', 'F5D', 'A5D', 'B5D', 'P5D', 'P1', 'P1D', 'P2', 'P2D', 'P0'];

    if (file.name.toLowerCase().endsWith('.zip')) {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const fileNames = Object.keys(zip.files);
      
      for (const filename of fileNames) {
        if (!zip.files[filename].dir) {
          const innerUpper = filename.toUpperCase();
          if (PRIORIDAD_MAP.some(pat => innerUpper.includes(pat))) {
            const content = await zip.files[filename].async('string');
            const fileResult = await processCchCsv(content, filename, 'UPLOAD_ZIP');
            results.success += fileResult.success;
            results.skipped += fileResult.skipped;
            results.errors += fileResult.errors;
          }
        }
      }
    } else {
      const filenameUpper = file.name.toUpperCase();
      const lower = file.name.toLowerCase();
      if (PRIORIDAD_MAP.some(pat => filenameUpper.includes(pat)) || lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.gz') || lower.endsWith('.xlsx')) {
        let content = '';
        if (lower.endsWith('.gz')) {
          const zlib = require('zlib');
          content = zlib.gunzipSync(Buffer.from(arrayBuffer)).toString('utf8');
        } else if (lower.endsWith('.xlsx')) {
          const XLSX = require('xlsx');
          const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          content = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ';' });
        } else {
          const decoder = new TextDecoder('utf-8');
          content = decoder.decode(arrayBuffer);
        }
        
        const fileResult = await processCchCsv(content, file.name, 'UPLOAD_CSV');
        results.success += fileResult.success;
        results.skipped += fileResult.skipped;
        results.errors += fileResult.errors;
      } else {
        return NextResponse.json({ error: 'Fichero no reconocido. Debe contener patrones como F1, F5D, P1D...' }, { status: 400 });
      }
    }

    return NextResponse.json({ message: 'Procesamiento completado', results });

  } catch (error: any) {
    console.error('ETL Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
