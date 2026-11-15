import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePenaltyAdminAccess } from '@/lib/bajasServer';

function isFetchableCloudUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !url.includes('airtableusercontent.com')
  );
}

export async function POST(req: Request) {
  try {
    const { visibilityFilter } = await requirePenaltyAdminAccess();

    const { invoiceIds } = await req.json();
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'No se han seleccionado facturas.' }, { status: 400 });
    }

    const invoices = await prisma.penaltyInvoice.findMany({
      where: {
        id: { in: invoiceIds },
        contract: { ...visibilityFilter },
      },
      select: {
        invoiceNumber: true,
        pdfUrl: true,
      },
      orderBy: { invoiceNumber: 'asc' },
    });

    const zip = new AdmZip();
    let addedFilesCount = 0;

    // Deduplicate multipoint PDFs sharing the same pdfUrl while naming cleanly
    const seenUrls = new Set<string>();
    const uniqueDownloadTargets = invoices.filter((inv) => {
      if (!isFetchableCloudUrl(inv.pdfUrl)) return false;
      if (seenUrls.has(inv.pdfUrl)) return false;
      seenUrls.add(inv.pdfUrl);
      return true;
    });

    const CONCURRENCY = 10;
    for (let i = 0; i < uniqueDownloadTargets.length; i += CONCURRENCY) {
      const batch = uniqueDownloadTargets.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (inv) => {
          const url = inv.pdfUrl!;
          // If it's a multipoint sub-number (A26PEN027-1) whose PDF is A26PEN027.pdf, preserve clean name
          const safeName = String(inv.invoiceNumber || 'penalizacion').replace(
            /[\\/:*?"<>|]/g,
            '_'
          );
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arrayBuffer = await res.arrayBuffer();
            zip.addFile(`${safeName}.pdf`, Buffer.from(arrayBuffer));
            addedFilesCount++;
          } catch (err) {
            console.error(`Error fetching penalty PDF (${inv.invoiceNumber}):`, err);
          }
        })
      );
    }

    if (addedFilesCount === 0) {
      return NextResponse.json(
        {
          error:
            'Ninguna de las facturas seleccionadas dispone de un PDF descargable en la nube (R2).',
        },
        { status: 404 }
      );
    }

    const zipBuffer = zip.toBuffer();

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition':
          'attachment; filename="facturas_penalizaciones_seleccionadas.zip"',
      },
    });
  } catch (error: any) {
    console.error('Error creating penalty invoices ZIP:', error);
    const status = String(error?.message || '').includes('permisos') ? 403 : 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status }
    );
  }
}
