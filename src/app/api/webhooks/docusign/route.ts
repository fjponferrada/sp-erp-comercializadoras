import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFileToR2 } from '@/lib/r2';


export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // DocuSign Connect (JSON) envía un evento y la data.
    const event = payload.event;
    const envelopeId = payload.data?.envelopeId;
    const status = payload.data?.envelopeSummary?.status;
    const completedDateTime = payload.data?.envelopeSummary?.completedDateTime;

    if (!envelopeId) {
      return NextResponse.json({ error: 'Falta envelopeId' }, { status: 400 });
    }

    if (event === 'envelope-completed' || status === 'completed') {
      console.log(`[DOCUSIGN WEBHOOK] Recibido sobre completado: ${envelopeId}`);
      
      const contract = await prisma.contract.findUnique({
        where: { docusignEnvelopeId: envelopeId }
      });

      if (!contract) {
        console.warn(`[DOCUSIGN WEBHOOK] Contrato no encontrado para envelopeId: ${envelopeId}`);
        return NextResponse.json({ success: true, message: 'Sobre ignorado (no está en BD)' });
      }

      // Evitar procesar si ya está aceptado
      if (contract.status === 'ACEPTADO' && contract.filePdfSigned) {
         return NextResponse.json({ success: true, message: 'Ya estaba procesado' });
      }

      // Autenticar con JWT para descargar documento
      const jwt = require('jsonwebtoken');
      const authServer = process.env.DOCUSIGN_OAUTH_BASE_PATH || 'account-d.docusign.com';
      const privateKey = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

      const token = jwt.sign({
        iss: process.env.DOCUSIGN_INTEGRATION_KEY,
        sub: process.env.DOCUSIGN_USER_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: authServer,
        scope: "signature impersonation"
      }, privateKey, { algorithm: 'RS256' });

      const oauthUrl = `https://${authServer}/oauth/token`;
      const tokenRes = await fetch(oauthUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
      });
      const results = await tokenRes.json();
      
      if (results.error) {
        throw new Error(`Error de auth en webhook: ${results.error} - ${results.error_description}`);
      }
      
      const accessToken = results.access_token;
      const accountId = process.env.DOCUSIGN_ACCOUNT_ID || '';
      
      // Descargamos el documento "combined" directamente usando fetch con el token
      // Es más seguro para binarios que el getDocument del SDK en NodeJS
      const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
      const downloadUrl = `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined?certificate=true`;
      
      const res = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!res.ok) {
         throw new Error(`Error al descargar PDF firmado: ${res.statusText}`);
      }
      
      const pdfArrayBuffer = await res.arrayBuffer();
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      // Subir a Cloudflare R2
      const fileName = `contrato_firmado_${contract.contractCode}.pdf`;
      const r2Url = await uploadFileToR2(`contracts/signed/${fileName}`, pdfBuffer, 'application/pdf');

      // Actualizar Contrato
      const sigDate = completedDateTime ? new Date(completedDateTime) : new Date();
      const updateData: any = {
        status: 'ACEPTADO',
        signatureDate: sigDate
      };
      
      if (contract.previousContractId && contract.tipo === 'M1') {
        updateData.fileAnexoFirmado = r2Url;
      } else {
        updateData.filePdfSigned = r2Url;
      }

      await prisma.contract.update({
        where: { id: contract.id },
        data: updateData
      });

      console.log(`[DOCUSIGN WEBHOOK] Contrato ${contract.contractCode} firmado y procesado con éxito.`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DOCUSIGN WEBHOOK ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
