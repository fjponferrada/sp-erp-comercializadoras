import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Docusign Connect envía varios tipos de eventos, por ejemplo:
    // "envelope-completed" o "envelope-signed"
    const event = body.event;
    const envelopeId = body.data?.envelopeId;

    if (!envelopeId) {
      return NextResponse.json({ error: 'Missing envelopeId' }, { status: 400 });
    }

    if (event === 'envelope-completed') {
      // 1. Buscar en Lead
      const lead = await prisma.lead.findUnique({
        where: { docusignEnvelopeId: envelopeId }
      });

      if (lead) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: 'FIRMADO' // Actualizar al estado correspondiente
            // TODO: En un sistema real, aquí descargaríamos el PDF de Docusign y lo subiríamos a Vercel Blob,
            // guardando la URL en 'signedUrl'. Por ahora solo marcamos fecha y estado.
          }
        });
        return NextResponse.json({ success: true, type: 'Lead', id: lead.id });
      }

      // 2. Si no es Lead, buscar en Contract
      const contract = await prisma.contract.findUnique({
        where: { docusignEnvelopeId: envelopeId }
      });

      if (contract) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            signatureDate: new Date(),
            status: 'ACTIVO' // O TRAMITANDO, según corresponda
          }
        });
        return NextResponse.json({ success: true, type: 'Contract', id: contract.id });
      }

      return NextResponse.json({ error: 'No record found for this envelopeId' }, { status: 404 });
    }

    // Ignoramos otros eventos de Docusign (ej. envelope-created, envelope-delivered)
    return NextResponse.json({ success: true, message: `Ignored event ${event}` });

  } catch (error: any) {
    console.error("Docusign Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
