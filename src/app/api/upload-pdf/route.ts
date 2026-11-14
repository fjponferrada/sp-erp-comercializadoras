import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFileToR2 } from '@/lib/r2';
import path from 'path';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

function isValidCloudDocumentUrl(url: unknown): boolean {
  return (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !url.includes('airtable')
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userRole = (session.user as any)?.role || 'user';
    if (!['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole)) {
      return NextResponse.json({ error: 'No tienes permisos para subir documentos de facturación' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const allowOverwrite = formData.get('overwrite') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No se ha proporcionado ningún archivo' }, { status: 400 });
    }

    // El nombre del archivo suele ser NumeroFactura.pdf (ej. A260613509.pdf o A260613509.xml)
    const originalFilename = file.name;
    const extension = path.extname(originalFilename);
    const extLower = extension.toLowerCase();

    if (extLower !== '.pdf' && extLower !== '.xml') {
      return NextResponse.json({ error: `Extensión no soportada (${extension}). Solo se admiten .pdf y .xml` }, { status: 400 });
    }

    const invoiceNumber = path.basename(originalFilename, extension).trim();
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const cookieBrandId = cookieStore.get('active-brand')?.value;
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { companies: true }
    });

    const activeBrandId = cookieBrandId || user?.brandId || (session.user as any)?.brandId;

    // Construir filtro de marca/empresa respetando multi-marca y rol
    let brandFilter: any = {};
    if (userRole === 'SUPERADMIN') {
      if (activeBrandId) {
        brandFilter = { client: { brandId: activeBrandId } };
      }
    } else if (userRole === 'COMPANYADMIN') {
      const companyIds = user?.companies.map((c) => c.id) || [];
      brandFilter = activeBrandId
        ? { client: { brandId: activeBrandId, brand: { companyId: { in: companyIds } } } }
        : { client: { brand: { companyId: { in: companyIds } } } };
    } else {
      brandFilter = { client: { brandId: activeBrandId } };
    }

    let invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber, ...brandFilter }
    });

    // Fallback para SUPERADMIN si la factura pertenece a otra marca del grupo
    if (!invoice && userRole === 'SUPERADMIN' && activeBrandId) {
      invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber }
      });
    }

    if (!invoice) {
      return NextResponse.json(
        {
          error: `No se ha encontrado ninguna factura importada con el número: ${invoiceNumber}. Importa primero el CSV.`
        },
        { status: 404 }
      );
    }

    const isXml = extLower === '.xml';

    if (!allowOverwrite) {
      if (isXml) {
        const currentXml =
          invoice.xmlUrl ||
          (invoice.invoiceData as any)?.xmlUrl ||
          (invoice.invoiceData as any)?.XML ||
          (invoice.invoiceData as any)?.xML;
        if (isValidCloudDocumentUrl(currentXml)) {
          return NextResponse.json(
            {
              error: `La factura ${invoiceNumber} ya tiene un documento XML adjunto en la nube. Marca "Sobrescribir existentes" si deseas reemplazarlo.`
            },
            { status: 400 }
          );
        }
      } else {
        if (isValidCloudDocumentUrl(invoice.pdfUrl)) {
          return NextResponse.json(
            {
              error: `La factura ${invoiceNumber} ya tiene un PDF adjunto en la nube. Marca "Sobrescribir existentes" si deseas reemplazarlo.`
            },
            { status: 400 }
          );
        }
      }
    }

    // Almacenamiento en la Nube con Cloudflare R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = isXml ? 'application/xml' : file.type || 'application/pdf';
    const safeBaseName = `${invoiceNumber}${extLower}`;
    const url = await uploadFileToR2(`facturas/${Date.now()}-${safeBaseName}`, buffer, contentType);

    // Actualizar BD con la URL pública devuelta por R2 (tanto columna nativa como JSONB en caso de XML)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: isXml
        ? {
            xmlUrl: url,
            invoiceData: { ...((invoice.invoiceData as any) || {}), xmlUrl: url }
          }
        : { pdfUrl: url }
    });

    return NextResponse.json({
      success: true,
      invoiceNumber,
      url
    });
  } catch (error: any) {
    console.error('R2 Upload error:', error);

    if (error.message && error.message.includes('R2_BUCKET_NAME')) {
      return NextResponse.json(
        {
          error: 'El almacenamiento en la nube no está configurado. Añade tus credenciales de R2 en el archivo .env'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
