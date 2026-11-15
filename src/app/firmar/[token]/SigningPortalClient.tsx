'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  KeyRound,
  Lock,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  AlertCircle,
} from 'lucide-react';
import {
  acceptPrecontractualSummaryAction,
  completeOtpSignatureAction,
  completeQualifiedCertUploadSignatureAction,
  requestSigningOtpAction,
} from '@/app/actions/signatureActions';

interface PublicEnvelopeProps {
  envelopeCode: string;
  status: string;
  documentKind: string;
  flowMode: string;
  signerName: string;
  signerNif: string;
  maskedEmail: string;
  maskedPhone: string | null;
  hasPhone: boolean;
  isB2B: boolean;
  tariff: string;
  allowCertUploadFallback: boolean;
  summaryAcceptedAt: string | null;
  summaryPdfHashSha256: string;
  contractPdfHashSha256: string;
  otpSent: boolean;
  otpChannel: string | null;
  expiresAt: string;
  signedAt: string | null;
  signatureMethod: string | null;
  verificationUrl: string;
  contractInfo: {
    contractCode: string;
    cups: string;
    supplyAddress: string;
    productName: string;
    ibanMasked: string | null;
    isTransferencia: boolean;
  };
  brand: {
    name: string;
    logoUrl: string | null;
    accentColor: string;
    supportEmail: string | null;
    freePhone900: string | null;
    companyName: string;
    companyCif: string;
  };
}

export default function SigningPortalClient({
  token,
  initialEnvelope,
}: {
  token: string;
  initialEnvelope: PublicEnvelopeProps;
}) {
  const [env, setEnv] = useState<PublicEnvelopeProps>(initialEnvelope);
  const [summaryChecked, setSummaryChecked] = useState(Boolean(initialEnvelope.summaryAcceptedAt));
  const [isAcceptingSummary, setIsAcceptingSummary] = useState(false);

  // Selector de método en Paso 2: SIEMPRE por defecto 'OTP_PADES'
  const [activeSignTab, setActiveSignTab] = useState<'OTP_PADES' | 'QUALIFIED_CERT'>('OTP_PADES');

  // Estado Firma OTP + Rúbrica
  const [acceptedTermsAndSepa, setAcceptedTermsAndSepa] = useState(false);
  const [otpRequested, setOtpRequested] = useState(initialEnvelope.otpSent);
  const [otpChannelLabel, setOtpChannelLabel] = useState<string>(
    initialEnvelope.otpChannel || (initialEnvelope.hasPhone ? 'SMS y Email' : 'Email')
  );
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);

  // Canvas Rúbrica Táctil / Ratón
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [hasDrawnRubric, setHasDrawnRubric] = useState(false);

  // Estado Alternativa Secundaria Certificado Cualificado
  const [selectedSignedFile, setSelectedSignedFile] = useState<File | null>(null);
  const [isUploadingCertPdf, setIsUploadingCertPdf] = useState(false);

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  // Inicializar resolución HiDPI del lienzo de rúbrica cuando el Paso 2 está visible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && canvas.width !== Math.floor(rect.width * ratio)) {
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#0f172a';
      }
    }
  }, [env.summaryAcceptedAt, activeSignTab]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    isDrawingRef.current = true;
    setHasDrawnRubric(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const clearRubricCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnRubric(false);
  };

  const summaryInlineUrl = `/api/signature/document?token=${encodeURIComponent(token)}&doc=summary`;
  const summaryDownloadUrl = `${summaryInlineUrl}&download=1`;
  const contractInlineUrl = `/api/signature/document?token=${encodeURIComponent(token)}&doc=contract`;
  const contractDownloadUrl = `${contractInlineUrl}&download=1`;
  const signedContractDownloadUrl = `/api/signature/document?token=${encodeURIComponent(token)}&doc=signed&download=1`;
  const signedSummaryDownloadUrl = `/api/signature/document?token=${encodeURIComponent(token)}&doc=signed_summary&download=1`;
  const auditTrailDownloadUrl = `/api/signature/document?token=${encodeURIComponent(token)}&doc=audit&download=1`;

  const handleAcceptSummary = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!summaryChecked) {
      setErrorMsg('Por favor, marque la casilla confirmando la lectura del Documento Resumen Precontractual.');
      return;
    }

    setIsAcceptingSummary(true);
    try {
      const res = await acceptPrecontractualSummaryAction(token);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setEnv((prev) => ({
          ...prev,
          status: 'SUMMARY_ACCEPTED',
          summaryAcceptedAt: res.acceptedAtIso || new Date().toISOString(),
        }));
        if (res.step2EmailDispatched) {
          setInfoMsg(
            'Documento Resumen aceptado. También le hemos enviado por email una copia del Contrato completo desbloqueado.'
          );
        } else {
          setInfoMsg('Documento Resumen Precontractual aceptado correctamente. Ya puede revisar y firmar su contrato.');
        }
      }
    } finally {
      setIsAcceptingSummary(false);
    }
  };

  const handleRequestOtp = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsRequestingOtp(true);
    try {
      const res = await requestSigningOtpAction(token);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setOtpRequested(true);
        setCooldownSec(30);
        const ch = res.channelUsed || 'Email';
        setOtpChannelLabel(ch);
        setInfoMsg(
          `Código de 6 dígitos enviado por ${ch} (${res.maskedEmail}${res.maskedPhone ? ` / ${res.maskedPhone}` : ''}).`
        );
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleCompleteOtpSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!hasDrawnRubric) {
      setErrorMsg('Por favor, dibuje su firma o rúbrica en el recuadro de firma antes de finalizar.');
      return;
    }
    if (!acceptedTermsAndSepa) {
      setErrorMsg('Debe aceptar las condiciones contractuales para formalizar la firma.');
      return;
    }
    if (otpCode.replace(/\D/g, '').length !== 6) {
      setErrorMsg('Introduzca el código de verificación de 6 dígitos recibido.');
      return;
    }

    const rubricDataUrl = canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;

    setIsSubmittingSignature(true);
    try {
      const res = await completeOtpSignatureAction({
        token,
        otpCode,
        rubricDataUrl,
        acceptedTermsAndSepa,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setEnv((prev) => ({
          ...prev,
          status: 'SIGNED',
          signedAt: new Date().toISOString(),
          signatureMethod: 'OTP_PADES',
          verificationUrl: res.verificationUrl || prev.verificationUrl,
        }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  const handleUploadQualifiedCertPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!selectedSignedFile) {
      setErrorMsg('Seleccione el archivo PDF firmado con su Certificado Digital cualificado.');
      return;
    }

    setIsUploadingCertPdf(true);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('signedPdf', selectedSignedFile);
      const res = await completeQualifiedCertUploadSignatureAction(fd);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setEnv((prev) => ({
          ...prev,
          status: 'SIGNED',
          signedAt: new Date().toISOString(),
          signatureMethod: 'QUALIFIED_CERT_UPLOAD',
          verificationUrl: res.verificationUrl || prev.verificationUrl,
        }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsUploadingCertPdf(false);
    }
  };

  // Estados terminales: CANCELLED / EXPIRED
  if (env.status === 'CANCELLED' || env.status === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 py-4 px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {env.brand.logoUrl ? (
              <img src={env.brand.logoUrl} alt={env.brand.name} className="h-10 object-contain" />
            ) : (
              <span className="text-lg font-extrabold text-slate-900">{env.brand.name}</span>
            )}
            <span className="text-xs font-mono text-slate-500">{env.envelopeCode}</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {env.status === 'CANCELLED' ? 'Sobre de firma sustituido o anulado' : 'Enlace de firma caducado'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {env.status === 'CANCELLED'
                ? 'Este documento ha sido actualizado o anulado por la comercializadora. Revise si ha recibido un correo más reciente con las nuevas condiciones.'
                : 'El plazo de validez de este enlace ha vencido por seguridad. Solicite a su gestor comercial que le reenvíe la invitación.'}
            </p>
            {env.brand.freePhone900 && (
              <p className="text-xs text-slate-500">
                Atención gratuita {env.brand.name}: <strong>{env.brand.freePhone900}</strong>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Estado terminal exitoso: SIGNED
  if (env.status === 'SIGNED') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
        <header className="bg-white border-b border-slate-200 py-4 px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {env.brand.logoUrl ? (
              <img src={env.brand.logoUrl} alt={env.brand.name} className="h-10 object-contain" />
            ) : (
              <span className="text-lg font-extrabold text-slate-900">{env.brand.name}</span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={14} /> Firmado y Sellado
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck size={34} />
            </div>
            <h1 className="text-2xl font-extrabold text-center text-slate-900 mb-2">
              ¡Contrato firmado electrónicamente con éxito!
            </h1>
            <p className="text-sm text-center text-slate-600 max-w-xl mx-auto mb-6 leading-relaxed">
              Hemos enviado una copia íntegra sellada en soporte duradero a <strong>{env.maskedEmail}</strong>. También
              puede descargar ahora mismo sus documentos oficiales:
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs sm:text-sm space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">ID de Sobre Criptográfico:</span>
                <span className="font-mono font-bold text-slate-900">{env.envelopeCode}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Referencia Contrato:</span>
                <span className="font-semibold text-slate-900">{env.contractInfo.contractCode}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">CUPS:</span>
                <span className="font-mono text-slate-900">{env.contractInfo.cups}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Firmante:</span>
                <span className="font-semibold text-slate-900">
                  {env.signerName} ({env.signerNif})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <a
                href={signedContractDownloadUrl}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors text-center"
              >
                <Download size={16} /> Contrato Firmado
              </a>
              <a
                href={signedSummaryDownloadUrl}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs sm:text-sm font-semibold transition-colors text-center"
              >
                <Download size={16} /> Resumen RD 88/2026
              </a>
              <a
                href={auditTrailDownloadUrl}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs sm:text-sm font-semibold transition-colors text-center"
              >
                <Download size={16} /> Certificado Evidencias
              </a>
            </div>

            <div className="text-center pt-4 border-t border-slate-100">
              <a
                href={env.verificationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
              >
                <ExternalLink size={13} /> Consultar página pública de verificación criptográfica ({env.envelopeCode})
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isStep1Completed = Boolean(env.summaryAcceptedAt);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Cabecera Blanca Multi-Marca */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {env.brand.logoUrl ? (
              <img src={env.brand.logoUrl} alt={env.brand.name} className="h-9 sm:h-10 object-contain" />
            ) : (
              <span className="text-lg font-extrabold text-slate-900">{env.brand.name}</span>
            )}
            <div className="hidden sm:block pl-3 border-l border-slate-200">
              <div className="text-xs font-bold text-slate-800">Portal Seguro de Firma Electrónica</div>
              <div className="text-[11px] text-slate-500">
                {env.brand.companyName} · {env.envelopeCode}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-semibold">
            <Lock size={13} /> Conexión Cifrada eIDAS
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Resumen Rápido de Suministro */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase block mb-0.5">Titular / Firmante</span>
              <span className="font-bold text-slate-900 text-sm block">{env.signerName}</span>
              <span className="text-slate-500">{env.signerNif}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase block mb-0.5">CUPS y Tarifa</span>
              <span className="font-mono font-bold text-slate-900 text-sm block">{env.contractInfo.cups || '-'}</span>
              <span className="text-slate-500">
                Tarifa {env.tariff} · {env.contractInfo.productName}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400 font-semibold uppercase block mb-0.5">Punto de Suministro</span>
              <span className="font-semibold text-slate-800 text-sm block">
                {env.contractInfo.supplyAddress || '-'}
              </span>
              <span className="text-slate-500">Ref. Contrato: {env.contractInfo.contractCode}</span>
            </div>
          </div>
        </section>

        {/* Stepper Visual 2 Fases (RD 88/2026) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`rounded-xl p-3.5 border flex items-center gap-3 ${
              isStep1Completed
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                : 'bg-slate-900 border-slate-900 text-white shadow-sm'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                isStep1Completed ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900'
              }`}
            >
              {isStep1Completed ? <CheckCircle2 size={18} /> : '1'}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide">Paso 1 · Precontractual (RD 88/2026)</div>
              <div className={`text-xs ${isStep1Completed ? 'text-emerald-700 font-medium' : 'text-slate-300'}`}>
                {isStep1Completed
                  ? `Aceptado el ${new Date(env.summaryAcceptedAt!).toLocaleString('es-ES')}`
                  : 'Lectura y conformidad del Documento Resumen'}
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl p-3.5 border flex items-center gap-3 ${
              isStep1Completed
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                isStep1Completed ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-400'
              }`}
            >
              2
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide">Paso 2 · Contrato y Firma Electrónica</div>
              <div className={`text-xs ${isStep1Completed ? 'text-slate-300' : 'text-slate-400'}`}>
                {isStep1Completed
                  ? 'Revisión del contrato y firma con código OTP'
                  : 'Se desbloquea tras aceptar el Documento Resumen'}
              </div>
            </div>
          </div>
        </div>

        {/* Mensajes de Error / Info */}
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            FASE 1 (BLOQUEANTE): DOCUMENTO RESUMEN PRECONTRACTUAL RD 88/2026
           ═══════════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <FileText className="text-slate-700" size={20} />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Documento Resumen Precontractual (Real Decreto 88/2026)
                </h2>
                <p className="text-xs text-slate-500">
                  Síntesis transparente e independiente de precios, permanencia, servicios y derechos del consumidor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={summaryInlineUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
              >
                <ExternalLink size={13} /> Abrir pantalla completa
              </a>
              <a
                href={summaryDownloadUrl}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white inline-flex items-center gap-1.5"
              >
                <Download size={13} /> Descargar PDF
              </a>
            </div>
          </div>

          {!isStep1Completed ? (
            <div className="p-4 sm:p-6 space-y-5">
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                <iframe
                  src={`${summaryInlineUrl}#view=FitH`}
                  title="Documento Resumen Precontractual"
                  className="w-full h-[460px] sm:h-[560px]"
                />
              </div>

              <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={summaryChecked}
                    onChange={(e) => setSummaryChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    <strong>Declaración precontractual (RD 88/2026):</strong> Confirmo que he recibido, leído y
                    comprendido el <strong>Documento Resumen Precontractual</strong> puesto a mi disposición con carácter
                    previo e independiente, y deseo continuar hacia la lectura y firma del contrato de suministro.
                  </span>
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAcceptSummary}
                    disabled={isAcceptingSummary || !summaryChecked}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isAcceptingSummary ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Registrando conformidad...
                      </>
                    ) : (
                      <>
                        <FileCheck2 size={16} /> Confirmar lectura del Resumen y ver Contrato →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3.5 bg-emerald-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <CheckCircle2 size={15} className="text-emerald-600" /> Documento Resumen Precontractual aceptado el{' '}
                {new Date(env.summaryAcceptedAt!).toLocaleString('es-ES')}
              </span>
              <span className="font-mono text-[11px] text-emerald-700">
                SHA-256: {env.summaryPdfHashSha256.slice(0, 20)}...
              </span>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            FASE 2 (DESBLOQUEADA TRAS T1): CONTRATO COMPLETO Y FIRMA ELECTRÓNICA
           ═══════════════════════════════════════════════════════════════════════ */}
        {isStep1Completed && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="text-slate-800" size={20} />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    2. Contrato de Suministro Eléctrico y Firma Electrónica
                  </h2>
                  <p className="text-xs text-slate-500">
                    Condiciones Particulares, Condiciones Generales y Mandato de Domiciliación SEPA
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={contractInlineUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={13} /> Ver todas las páginas
                </a>
                <a
                  href={contractDownloadUrl}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white inline-flex items-center gap-1.5"
                >
                  <Download size={13} /> Descargar Contrato PDF
                </a>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Visor del Contrato Completo */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                <iframe
                  src={`${contractInlineUrl}#view=FitH`}
                  title="Contrato de Suministro Eléctrico"
                  className="w-full h-[500px] sm:h-[620px]"
                />
              </div>

              {/* Selector de modalidad: Firma Digital OTP es SIEMPRE la principal; Certificado Cualificado es alternativa secundaria solo en B2B / 3.0TD / 6.1TD */}
              {env.allowCertUploadFallback && (
                <div className="border-b border-slate-200 pb-3">
                  <div className="text-xs font-bold uppercase text-slate-500 mb-2">
                    Modalidad de firma disponible para su suministro ({env.tariff})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSignTab('OTP_PADES');
                        setErrorMsg(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        activeSignTab === 'OTP_PADES'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                          <Smartphone size={15} /> Firma Digital Rápida (OTP + Rúbrica)
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            activeSignTab === 'OTP_PADES'
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Recomendada
                        </span>
                      </div>
                      <p
                        className={`text-[11px] ${
                          activeSignTab === 'OTP_PADES' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Firme ahora mismo desde su móvil u ordenador con código de 6 dígitos sin instalar programas.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveSignTab('QUALIFIED_CERT');
                        setErrorMsg(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        activeSignTab === 'QUALIFIED_CERT'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                          <KeyRound size={15} /> Subir PDF con Certificado Digital
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            activeSignTab === 'QUALIFIED_CERT'
                              ? 'bg-slate-700 text-slate-200'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          Opcional B2B
                        </span>
                      </div>
                      <p
                        className={`text-[11px] ${
                          activeSignTab === 'QUALIFIED_CERT' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Alternativa secundaria si prefiere firmar localmente con FNMT, Camerfirma, DNIe o AutoFirma.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* ── OPCIÓN 1 (UNIVERSAL POR DEFECTO): FIRMA DIGITAL OTP + RÚBRICA ── */}
              {activeSignTab === 'OTP_PADES' ? (
                <form onSubmit={handleCompleteOtpSignature} className="space-y-5">
                  {/* Lienzo de Rúbrica */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <PenTool size={15} /> Dibuje su firma en el recuadro (con el dedo o ratón)
                      </label>
                      <button
                        type="button"
                        onClick={clearRubricCanvas}
                        className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={13} /> Borrar trazo
                      </button>
                    </div>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden relative">
                      <canvas
                        ref={canvasRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        style={{ touchAction: 'none' }}
                        className="w-full h-36 sm:h-40 cursor-crosshair block"
                      />
                      {!hasDrawnRubric && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                          Firme aquí dentro
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consentimiento Contractual + Mandato SEPA */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={acceptedTermsAndSepa}
                        onChange={(e) => setAcceptedTermsAndSepa(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        He leído y acepto íntegramente las <strong>Condiciones Particulares y Generales</strong> del
                        contrato de suministro eléctrico con <strong>{env.brand.name}</strong>
                        {!env.contractInfo.isTransferencia && env.contractInfo.ibanMasked ? (
                          <>
                            , así como la <strong>Orden de Domiciliación de Adeudo Directo SEPA</strong> en la cuenta{' '}
                            <span className="font-mono font-semibold">{env.contractInfo.ibanMasked}</span>
                          </>
                        ) : null}
                        , autorizando las gestiones de contratación ante la empresa distribuidora.
                      </span>
                    </label>
                  </div>

                  {/* Solicitud e introducción de OTP */}
                  <div className="rounded-xl border border-slate-200 p-4 sm:p-5 bg-slate-50/50 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Verificación de identidad mediante código único (OTP)
                        </div>
                        <div className="text-xs text-slate-500">
                          Enviaremos un código de 6 dígitos a <strong>{env.maskedEmail}</strong>
                          {env.maskedPhone ? (
                            <>
                              {' '}
                              y al móvil <strong>{env.maskedPhone}</strong>
                            </>
                          ) : null}
                          .
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={isRequestingOtp || cooldownSec > 0}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                      >
                        {isRequestingOtp ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Enviando...
                          </>
                        ) : cooldownSec > 0 ? (
                          `Reenviar código (${cooldownSec}s)`
                        ) : otpRequested ? (
                          'Reenviar código OTP'
                        ) : (
                          'Enviar código OTP de firma'
                        )}
                      </button>
                    </div>

                    {otpRequested && (
                      <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Introduzca el código de 6 dígitos recibido ({otpChannelLabel}):
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white font-mono text-xl tracking-[0.4em] text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmittingSignature || otpCode.length !== 6}
                          className="px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                        >
                          {isSubmittingSignature ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" /> Sellando contrato PAdES...
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={18} /> Firmar Contrato Ahora
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                /* ── OPCIÓN 2 (ALTERNATIVA SECUNDARIA OPCIONAL B2B / 3.0TD / 6.1TD) ── */
                <form onSubmit={handleUploadQualifiedCertPdf} className="space-y-4">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-slate-700">
                    <div className="font-bold text-slate-900 text-sm">
                      Instrucciones para firmar con Certificado Electrónico Cualificado (Opcional Empresas):
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600">
                      <li>
                        Descargue el borrador oficial del contrato pulsando en{' '}
                        <a href={contractDownloadUrl} className="font-bold text-slate-900 underline">
                          Descargar Contrato PDF
                        </a>{' '}
                        (no modifique ni imprima/escanee el archivo para conservar su integridad digital).
                      </li>
                      <li>
                        Fírmelo en su ordenador mediante <strong>AutoFirma</strong> o{' '}
                        <strong>Adobe Acrobat Reader</strong> con su certificado digital en vigor (FNMT, Camerfirma,
                        Firmaprofesional o DNIe del titular o representante legal).
                      </li>
                      <li>Suba a continuación el archivo PDF resultante firmado criptográficamente (formato PAdES):</li>
                    </ol>

                    <div className="pt-2">
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-xl p-6 bg-white cursor-pointer transition-colors">
                        <Upload className="w-7 h-7 text-slate-500 mb-2" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          {selectedSignedFile ? selectedSignedFile.name : 'Seleccionar PDF firmado con certificado digital'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1">
                          Verificación automática X.509, vigencia y correspondencia de CIF/NIF
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(e) => setSelectedSignedFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isUploadingCertPdf || !selectedSignedFile}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isUploadingCertPdf ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" /> Verificando firma criptográfica X.509...
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={17} /> Validar Certificado y Completar Firma
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Pie Legal */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center text-xs text-slate-500 mt-10">
        <div className="max-w-4xl mx-auto space-y-1">
          <div>
            <strong>{env.brand.companyName}</strong> {env.brand.companyCif ? `· CIF ${env.brand.companyCif}` : ''}
            {env.brand.freePhone900 ? ` · Atención gratuita: ${env.brand.freePhone900}` : ''}
            {env.brand.supportEmail ? ` · ${env.brand.supportEmail}` : ''}
          </div>
          <div className="text-[11px] text-slate-400">
            Contratación electrónica sujeta al Reglamento (UE) 910/2014 (eIDAS), Ley 6/2020 y Real Decreto 88/2026.
          </div>
        </div>
      </footer>
    </div>
  );
}
