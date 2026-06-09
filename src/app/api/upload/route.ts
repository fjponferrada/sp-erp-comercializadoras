import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'documents';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Almacenamiento en la Nube con Vercel Blob
    const blob = await put(`${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`, file, {
      access: 'public',
    });

    return NextResponse.json({ 
      success: true, 
      url: blob.url,
      filename: file.name
    });

  } catch (error: any) {
    console.error("Vercel Blob Upload error:", error);
    
    if (error.message && error.message.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json({ 
        error: 'El almacenamiento en la nube no está configurado. Añade tu BLOB_READ_WRITE_TOKEN en el archivo .env' 
      }, { status: 500 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
