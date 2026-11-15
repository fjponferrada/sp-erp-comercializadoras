import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashSigningToken } from '@/lib/signature/cryptoPades';
import { appendSignatureAuditEvent } from '@/app/actions/signatureActions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim() || '';
    const docType = req.nextUrl.searchParams.get('doc')?.trim() || 'summary';
    const isDownload = req.nextUrl.searchParams.get('download') === '1';

    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Token no válido.' }, { status: 400 });
    }

    const tokenHash = hashSigningToken(token);
    const envelope = await prisma.signatureEnvelope.findUnique({
      where: { tokenHash },
      include: { contract: { select: { contractCode: true } } },
    });

    if (!envelope) {
      return NextResponse.json({ error: 'Sobre de firma no encontrado.' }, { status: 404 });
    }

    if (envelope.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Este sobre de firma ha sido anulado.' }, { status: 410 });
    }

    let targetUrl: string | null = null;
    let fileName = `Documento_${envelope.envelopeCode}.pdf`;
    const safeContractCode = (envelope.contract?.contractCode || envelope.envelopeCode).replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

    if (docType === 'summary') {
      targetUrl = envelope.signedSummaryPdfUrl || envelope.summaryPdfDraftUrl;
      fileName = `Documento_Resumen_Precontractual_${safeContractCode}.pdf`;
    } else if (docType === 'contract') {
      // Bloqueo estricto RD 88/2026: no se sirve el borrador contractual hasta haber aceptado T1
      if (!envelope.summaryAcceptedAt && envelope.status !== 'SIGNED') {
        return NextResponse.json(
          {
            error:
              'Conforme al Real Decreto 88/2026, debe revisar y aceptar primero el Documento Resumen Precontractual antes de acceder al contrato.',
          },
          { status: 403 }
        );
      }
      targetUrl = envelope.contractPdfDraftUrl;
      fileName = `Contrato_Suministro_${safeContractCode}.pdf`;

      // Registrar primera visualización del contrato completo en la cadena de auditoría si aún no está firmado
      if (envelope.status !== 'SIGNED') {
        const alreadyLogged = await prisma.signatureAuditEvent.findFirst({
          where: { envelopeId: envelope.id, eventType: 'CONTRACT_VIEWED' },
          select: { id: true },
        });
        if (!alreadyLogged) {
          const ip =
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') ||
            '127.0.0.1';
          const ua = req.headers.get('user-agent') || 'Navegador';
          await appendSignatureAuditEvent({
            envelopeId: envelope.id,
            eventType: 'CONTRACT_VIEWED',
            ipAddress: ip,
            userAgent: ua,
            metadataJson: { download: isDownload },
          });
        }
      }
    } else if (docType === 'signed') {
      targetUrl = envelope.signedPdfUrl;
      fileName = `Contrato_Firmado_${safeContractCode}.pdf`;
    } else if (docType === 'signed_summary') {
      targetUrl = envelope.signedSummaryPdfUrl;
      fileName = `Documento_Resumen_Aceptado_${safeContractCode}.pdf`;
    } else if (docType === 'audit') {
      targetUrl = envelope.auditTrailPdfUrl;
      fileName = `Certificado_Evidencias_${envelope.envelopeCode}.pdf`;
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'Documento no disponible en este estado.' }, { status: 404 });
    }

    const upstream = await fetch(targetUrl);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Error al obtener el PDF desde almacenamiento.' }, { status: 502 });
    }

    const pdfBytes = await upstream.arrayBuffer();
    const disposition = isDownload ? `attachment; filename="${fileName}"` : `inline; filename="${fileName}"`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('[API /api/signature/document ERROR]:', err);
    return NextResponse.json({ error: 'Error interno sirviendo documento.' }, { status: 500 });
  }
}
