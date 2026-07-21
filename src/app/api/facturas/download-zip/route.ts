import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

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

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { invoiceNumber: true, pdfUrl: true, xmlUrl: true, invoiceData: true }
    });

    const zip = new AdmZip();

    // Límite de concurrencia simple (Promise.all con todas puede ser pesado si son muchas, pero asumimos selección manual razonable)
    const fetchPromises = invoices.map(async (inv) => {
      const pdfUrl = inv.pdfUrl || (inv.invoiceData as any)?.output_pdf;
      const xmlUrl = inv.xmlUrl || (inv.invoiceData as any)?.XML || (inv.invoiceData as any)?.xmlUrl || (inv.invoiceData as any)?.xML;

      const tasks = [];
      if (pdfUrl) {
        tasks.push(
          fetch(pdfUrl)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.arrayBuffer();
            })
            .then(buffer => {
              zip.addFile(`${inv.invoiceNumber}.pdf`, Buffer.from(buffer));
            })
            .catch(err => console.error(`Failed to fetch PDF for ${inv.invoiceNumber}:`, err))
        );
      }
      if (xmlUrl) {
        tasks.push(
          fetch(xmlUrl)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.arrayBuffer();
            })
            .then(buffer => {
              zip.addFile(`${inv.invoiceNumber}.xml`, Buffer.from(buffer));
            })
            .catch(err => console.error(`Failed to fetch XML for ${inv.invoiceNumber}:`, err))
        );
      }
      return Promise.all(tasks);
    });

    await Promise.all(fetchPromises);

    const zipBuffer = zip.toBuffer();

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="facturas_seleccionadas.zip"'
      }
    });

  } catch (error) {
    console.error("Error creating zip:", error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
