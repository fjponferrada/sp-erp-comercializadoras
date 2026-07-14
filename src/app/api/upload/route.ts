import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToR2 } from '@/lib/r2';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1];
    const isApiKey = token && token === process.env.AED_API_KEY;

    if (!isApiKey) {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'documents';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Almacenamiento en la Nube con Cloudflare R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filenameSafe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const url = await uploadFileToR2(`${folder}/${Date.now()}-${filenameSafe}`, buffer, file.type || 'application/octet-stream');

    return NextResponse.json({ 
      success: true, 
      url: url,
      filename: file.name
    });

  } catch (error: any) {
    console.error("R2 Upload error:", error);
    
    if (error.message && error.message.includes("R2_BUCKET_NAME")) {
      return NextResponse.json({ 
        error: 'El almacenamiento en la nube no está configurado. Añade tus credenciales R2 en el archivo .env' 
      }, { status: 500 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
