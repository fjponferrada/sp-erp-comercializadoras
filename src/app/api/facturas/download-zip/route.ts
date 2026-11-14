import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInvoiceVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';

function isFetchableCloudUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !url.includes('airtableusercontent.com')
  );
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { invoiceIds } = await req.json();
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return new NextResponse('No invoice IDs provided', { status: 400 });
    }

    const visibilityFilter = await getInvoiceVisibilityFilter();

    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        ...visibilityFilter,
      },
      select: { invoiceNumber: true, pdfUrl: true, xmlUrl: true, invoiceData: true }
    });

    const zip = new AdmZip();
    let addedFilesCount = 0;

    // Procesar en lotes de concurrencia controlada (10 simultáneos máx.)
    const CONCURRENCY = 10;
    for (let i = 0; i < invoices.length; i += CONCURRENCY) {
      const batch = invoices.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (inv) => {
          const d = (inv.invoiceData as any) || {};
          const pdfCandidate = isFetchableCloudUrl(inv.pdfUrl)
            ? inv.pdfUrl
            : isFetchableCloudUrl(d.output_pdf)
              ? d.output_pdf
              : null;
          const xmlCandidate = isFetchableCloudUrl(inv.xmlUrl)
            ? inv.xmlUrl
            : isFetchableCloudUrl(d.xmlUrl)
              ? d.xmlUrl
              : isFetchableCloudUrl(d.XML)
                ? d.XML
                : isFetchableCloudUrl(d.xML)
                  ? d.xML
                  : null;

          const safeName = String(inv.invoiceNumber || 'factura').replace(/[\\/:*?"<>|]/g, '_');

          const tasks: Promise<void>[] = [];
          if (pdfCandidate) {
            tasks.push(
              fetch(pdfCandidate)
                .then((res) => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return res.arrayBuffer();
                })
                .then((buffer) => {
                  zip.addFile(`${safeName}.pdf`, Buffer.from(buffer));
                  addedFilesCount++;
                })
                .catch((err) => console.error(`Failed to fetch PDF for ${inv.invoiceNumber}:`, err))
            );
          }
          if (xmlCandidate) {
            tasks.push(
              fetch(xmlCandidate)
                .then((res) => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return res.arrayBuffer();
                })
                .then((buffer) => {
                  zip.addFile(`${safeName}.xml`, Buffer.from(buffer));
                  addedFilesCount++;
                })
                .catch((err) => console.error(`Failed to fetch XML for ${inv.invoiceNumber}:`, err))
            );
          }
          await Promise.all(tasks);
        })
      );
    }

    if (addedFilesCount === 0) {
      return NextResponse.json(
        { error: 'Ninguna de las facturas seleccionadas dispone de PDF o XML válido en la nube (R2).' },
        { status: 404 }
      );
    }

    const zipBuffer = zip.toBuffer();

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="facturas_seleccionadas.zip"'
      }
    });
  } catch (error) {
    console.error('Error creating zip:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
