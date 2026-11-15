import React from 'react';
import { CheckCircle2, ShieldAlert, ShieldCheck, Lock, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { computeAuditChainHash } from '@/lib/signature/cryptoPades';

export const dynamic = 'force-dynamic';

function maskPublicNif(nif: string): string {
  const clean = String(nif || '').trim();
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 2)}****${clean.slice(-3)}`;
}

function maskPublicIp(ip?: string | null): string {
  if (!ip) return 'Servidor ERP';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  return ip.slice(0, 14) + '***';
}

const EVENT_TITLES: Record<string, string> = {
  ENVELOPE_CREATED: 'Generación del sobre criptográfico en origen (T0)',
  EMAIL_SUMMARY_SENT: 'Puesta a disposición previa del Documento Resumen RD 88/2026',
  ENVELOPE_RESENT: 'Reenvío de invitación al firmante',
  PORTAL_OPENED: 'Acceso del firmante al portal seguro',
  SUMMARY_ACCEPTED: 'Aceptación expresa del Documento Resumen Precontractual (T1)',
  STEP2_CONTRACT_EMAIL_SENT: 'Entrega desbloqueada del Contrato de Suministro (Paso 2)',
  CONTRACT_VIEWED: 'Visualización del Contrato completo',
  OTP_SENT: 'Emisión de código OTP de un solo uso',
  OTP_FAILED: 'Intento fallido de código OTP',
  OTP_VERIFIED: 'Autenticación OTP verificada con éxito (T2)',
  QUALIFIED_CERT_UPLOADED: 'Firma con Certificado Cualificado X.509 verificada (T2)',
  QUALIFIED_CERT_REJECTED: 'Rechazo de archivo sin firma válida',
  PADES_SEALED: 'Sellado criptográfico PAdES PKCS#7 y Marca de Tiempo (T3)',
  DURABLE_MEDIUM_SENT: 'Remisión de ejemplares sellados en soporte duradero',
  ENVELOPE_CANCELLED: 'Anulación del sobre de firma',
};

export default async function PublicVerifySignaturePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cleanCode = decodeURIComponent(code || '').trim();

  const envelope = await prisma.signatureEnvelope.findUnique({
    where: { envelopeCode: cleanCode },
    include: {
      brand: { include: { company: true } },
      contract: { select: { contractCode: true } },
      auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  if (!envelope) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Código de verificación no encontrado</h1>
          <p className="text-sm text-slate-600">
            No consta ningún sobre de firma electrónica registrado bajo el identificador{' '}
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{cleanCode}</code>.
          </p>
        </div>
      </div>
    );
  }

  // Verificar matemáticamente en vivo toda la cadena encadenada SHA-256 de eventos
  let chainIntact = envelope.auditEvents.length > 0;
  let runningPrevHash: string | null = null;

  for (const ev of envelope.auditEvents) {
    const meta: any = ev.metadataJson || {};
    const tsIso = meta._tsIso || ev.createdAt.toISOString();
    const expectedHash = computeAuditChainHash({
      envelopeId: envelope.id,
      eventType: ev.eventType,
      ipAddress: ev.ipAddress || '',
      userAgent: ev.userAgent || '',
      metadataJson: ev.metadataJson,
      prevEventHash: runningPrevHash,
      timestampIso: tsIso,
    });
    if ((ev.prevEventHash || null) !== runningPrevHash || ev.eventHash !== expectedHash) {
      chainIntact = false;
      break;
    }
    runningPrevHash = ev.eventHash;
  }

  const companyName = envelope.brand.company?.name || envelope.brand.name;
  const companyCif = envelope.brand.company?.cif || '';
  const logoUrl = envelope.brand.invoiceLogoUrl || envelope.brand.logoUrl || null;
  const isSigned = envelope.status === 'SIGNED';

  const fmtDate = (d?: Date | null) =>
    d
      ? d.toLocaleString('es-ES', {
          timeZone: 'Europe/Madrid',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '-';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabecera Corporativa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt={envelope.brand.name} className="h-10 object-contain mb-2" />
            ) : (
              <div className="text-xl font-extrabold text-slate-900 mb-1">{envelope.brand.name}</div>
            )}
            <div className="text-xs text-slate-500">
              {companyName} {companyCif ? `· CIF ${companyCif}` : ''}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            {isSigned && chainIntact ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck size={16} /> FIRMA VÁLIDA E INTEGRIDAD VERIFICADA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <Clock size={15} /> Estado del Sobre: {envelope.status}
              </span>
            )}
            <span className="text-xs font-mono text-slate-600 font-semibold">ID: {envelope.envelopeCode}</span>
          </div>
        </div>

        {/* Resumen Criptográfico y Regulatorio */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Lock size={18} className="text-slate-700" /> Registro Público de Verificación Criptográfica (eIDAS / RD
              88/2026)
            </h1>
            {chainIntact && (
              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 size={14} /> Cadena SHA-256 íntegra ({envelope.auditEvents.length} bloques)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 uppercase font-bold block mb-1">Contrato / Referencia</span>
              <span className="font-bold text-slate-900 text-sm">{envelope.contract?.contractCode || '-'}</span>
              <span className="block text-slate-500 mt-0.5">Tarifa {envelope.tariff || '-'}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 uppercase font-bold block mb-1">Identidad Firmante (RGPD)</span>
              <span className="font-bold text-slate-900 text-sm">{envelope.signerName}</span>
              <span className="block text-slate-500 font-mono mt-0.5">{maskPublicNif(envelope.signerNif)}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 uppercase font-bold block mb-1">Método Criptográfico</span>
              <span className="font-bold text-slate-900 text-sm">
                {envelope.signatureMethod === 'QUALIFIED_CERT_UPLOAD'
                  ? 'Certificado Cualificado X.509 (PAdES)'
                  : envelope.signatureMethod === 'OTP_PADES'
                  ? `Firma Avanzada OTP (${envelope.otpChannel || 'Email'}) + Sello PAdES`
                  : 'Pendiente de firma'}
              </span>
              {envelope.tsaProvider && (
                <span className="block text-slate-500 mt-0.5 truncate" title={envelope.tsaProvider}>
                  TSA: {envelope.tsaProvider}
                </span>
              )}
            </div>
          </div>

          {/* Prelación Temporal RD 88/2026 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-800 mb-1">
                T1 · Aceptación Previa Documento Resumen (RD 88/2026)
              </div>
              <div className="text-slate-600 mb-2">Fecha/Hora: {fmtDate(envelope.summaryAcceptedAt)}</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">SHA-256 Resumen Precontractual:</div>
              <div className="font-mono text-[11px] bg-slate-100 p-2 rounded mt-1 break-all text-slate-800">
                {envelope.summaryPdfHashSha256}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-800 mb-1">T2 / T3 · Firma del Contrato y Sellado PAdES</div>
              <div className="text-slate-600 mb-2">Fecha/Hora: {fmtDate(envelope.signedAt)}</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">
                {envelope.signedPdfHashSha256
                  ? 'SHA-256 Ejemplar Final Sellado:'
                  : 'SHA-256 Borrador Contractual Original:'}
              </div>
              <div className="font-mono text-[11px] bg-slate-100 p-2 rounded mt-1 break-all text-slate-800">
                {envelope.signedPdfHashSha256 || envelope.contractPdfHashSha256}
              </div>
            </div>
          </div>

          {envelope.signatureMethod === 'QUALIFIED_CERT_UPLOAD' && envelope.certSubjectDn && (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
              <div className="font-bold text-emerald-950">Datos Verificados del Certificado Electrónico X.509:</div>
              <div className="text-emerald-900">
                <strong>Subject DN:</strong> {envelope.certSubjectDn}
              </div>
              <div className="text-emerald-900">
                <strong>Emisor Cualificado (Issuer DN):</strong> {envelope.certIssuerDn}
              </div>
              <div className="text-emerald-900 font-mono text-[11px]">
                Nº Serie: {envelope.certSerialNumber}
              </div>
            </div>
          )}
        </div>

        {/* Tabla de Cadena de Bloques de Auditoría */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-4">
            Secuencia Cronológica Encadenada de Evidencias (Audit Trail)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                  <th className="py-2.5 pr-3">Fecha / Hora</th>
                  <th className="py-2.5 px-3">Hito Registrado</th>
                  <th className="py-2.5 px-3">Origen (RGPD)</th>
                  <th className="py-2.5 pl-3">Hash Encadenado SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {envelope.auditEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {fmtDate(ev.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {EVENT_TITLES[ev.eventType] || ev.eventType}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {maskPublicIp(ev.ipAddress)}
                    </td>
                    <td className="py-2.5 pl-3 font-mono text-[11px] text-slate-600" title={ev.eventHash}>
                      {ev.eventHash.slice(0, 20)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
