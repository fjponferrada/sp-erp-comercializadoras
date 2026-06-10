import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFileToR2 } from '@/lib/r2';
import path from 'path';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // El nombre del archivo suele ser NumeroFactura.pdf (ej. A260613509.pdf o A260613509.xml)
    const originalFilename = file.name;
    const extension = path.extname(originalFilename);
    const invoiceNumber = path.basename(originalFilename, extension).trim();

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email! } });

    // Buscamos si existe la factura en la BD
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber, client: { brandId: user!.brandId } }
    });

    if (!invoice) {
      return NextResponse.json({ 
        error: `No se ha encontrado ninguna factura importada con el número: ${invoiceNumber}. Importa primero el CSV.` 
      }, { status: 404 });
    }

    const isXml = extension.toLowerCase() === '.xml';

    if (isXml) {
      if (invoice.xML && !invoice.xML.includes('airtable')) {
        return NextResponse.json({
          error: `La factura ${invoiceNumber} ya tiene un documento XML adjunto definitivo. No se ha sobreescrito para evitar duplicados.`
        }, { status: 400 });
      }
    } else {
      if (invoice.pdfUrl && !invoice.pdfUrl.includes('airtable')) {
        return NextResponse.json({
          error: `La factura ${invoiceNumber} ya tiene un documento adjunto definitivo. No se ha sobreescrito para evitar duplicados.`
        }, { status: 400 });
      }
    }

    // Almacenamiento en la Nube con Cloudflare R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await uploadFileToR2(`facturas/${Date.now()}-${originalFilename}`, buffer, file.type || 'application/pdf');

    // Actualizar BD con la URL pública devuelta por R2
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: isXml ? { xML: url } : { pdfUrl: url }
    });

    return NextResponse.json({ 
      success: true, 
      invoiceNumber,
      url: url
    });

  } catch (error: any) {
    console.error("Vercel Blob Upload error:", error);
    
    if (error.message && error.message.includes("R2_BUCKET_NAME")) {
      return NextResponse.json({ 
        error: 'El almacenamiento en la nube no está configurado. Añade tus credenciales de R2 en el archivo .env' 
      }, { status: 500 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
