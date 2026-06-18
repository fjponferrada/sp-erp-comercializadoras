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

    if (file.name.toLowerCase().endsWith('.zip')) {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const fileNames = Object.keys(zip.files);
      
      for (const filename of fileNames) {
        if (!zip.files[filename].dir && (filename.toLowerCase().endsWith('.csv') || filename.toLowerCase().endsWith('.txt'))) {
          const content = await zip.files[filename].async('string');
          const fileResult = await processCchCsv(content, filename, 'UPLOAD_ZIP');
          results.success += fileResult.success;
          results.skipped += fileResult.skipped;
          results.errors += fileResult.errors;
        }
      }
    } else if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
      // Decode the array buffer to a string. Assuming utf-8 or similar
      const decoder = new TextDecoder('utf-8');
      const content = decoder.decode(arrayBuffer);
      const fileResult = await processCchCsv(content, file.name, 'UPLOAD_CSV');
      results.success += fileResult.success;
      results.skipped += fileResult.skipped;
      results.errors += fileResult.errors;
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Sube CSV, TXT o ZIP' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Procesamiento completado', results });

  } catch (error: any) {
    console.error('ETL Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
