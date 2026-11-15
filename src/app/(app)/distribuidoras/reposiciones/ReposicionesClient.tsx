'use client';

import { useState, useEffect } from 'react';
import {
  getPendingE2_14,
  respondToE2_14,
  generateE2_01,
  fetchReposicionContext,
  RecentLossCandidate,
} from '@/app/actions/reposicionesActions';
import { AlertCircle, FileText, CheckCircle, XCircle, Download, Loader2, Zap, CheckCircle2 } from 'lucide-react';
import { useBrandTheme } from '@/context/BrandThemeContext';
import Topbar from '@/components/Topbar';
import Link from 'next/link';
import toast from 'react-hot-toast';

const MOTIVOS_RECHAZO_E2_15 = [
  { codigo: '99', label: '99 - Otros motivos (se dispone de consentimiento expreso del cliente)' },
  { codigo: '03', label: '03 - NIF-CIF no coincide con el del contrato en vigor' },
  { codigo: '11', label: '11 - Comercializadora incorrecta' },
  { codigo: 'E1', label: 'E1 - CUPS no corresponde a la comercializadora' },
  { codigo: 'OTRO', label: 'Otro código oficial Tabla 27 (2 caracteres)...' },
];

export default function ReposicionesClient() {
  const [activeTab, setActiveTab] = useState<'recibidas' | 'solicitar'>('recibidas');
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const theme = useBrandTheme();

  // Estados para E2_01
  const [cups, setCups] = useState('');
  const [codigoRef, setCodigoRef] = useState('');
  const [tipoReposicion, setTipoReposicion] = useState('01');
  const [registerInErp, setRegisterInErp] = useState(true);
  const [fetchingCupsContext, setFetchingCupsContext] = useState(false);
  const [cupsContext, setCupsContext] = useState<{
    notFound?: boolean;
    cupsFull?: string;
    titular?: string | null;
    nif?: string;
    contractId?: string | null;
    contractCode?: string | null;
    contractStatus?: string | null;
    recentLosses?: RecentLossCandidate[];
  } | null>(null);

  // Estados para rechazo E2_15
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [motivoSelect, setMotivoSelect] = useState('99');
  const [customMotivo, setCustomMotivo] = useState('');
  const [comentariosRechazo, setComentariosRechazo] = useState(
    'Se rechaza la solicitud de reposición por disponer de contratación y consentimiento válido del titular.'
  );

  useEffect(() => {
    fetchPending();
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (cups.trim().length >= 16) {
      timeoutId = setTimeout(async () => {
        setFetchingCupsContext(true);
        try {
          const res = await fetchReposicionContext(cups);
          if (res.success) {
            setCupsContext(res);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setFetchingCupsContext(false);
        }
      }, 400);
    } else {
      setCupsContext(null);
    }
    return () => clearTimeout(timeoutId);
  }, [cups]);

  const fetchPending = async () => {
    setLoading(true);
    const res = await getPendingE2_14();
    if (res.success && res.data) {
      setPendingEvents(res.data);
    } else if (res.error) {
      toast.error(res.error);
    }
    setLoading(false);
  };

  const handleDownload = (base64Data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openRejectForm = (eventId: string) => {
    setSelectedEventId(eventId);
    setMotivoSelect('99');
    setCustomMotivo('');
    setComentariosRechazo(
      'Se rechaza la solicitud de reposición por disponer de contratación y consentimiento válido del titular.'
    );
  };

  const handleRespond = async (eventId: string, isAccept: boolean) => {
    let codigoFinal = '';
    if (!isAccept) {
      codigoFinal = (motivoSelect === 'OTRO' ? customMotivo : motivoSelect).trim().toUpperCase();
      if (!/^[0-9A-Z]{2}$/.test(codigoFinal)) {
        toast.error('Indica un código de motivo de rechazo válido de 2 caracteres (Tabla 27 CNMC).');
        return;
      }
      if (!comentariosRechazo.trim()) {
        toast.error('El campo de comentarios del rechazo es obligatorio.');
        return;
      }
    }

    setLoading(true);
    const motivos = isAccept ? undefined : [codigoFinal];
    const res = await respondToE2_14(
      eventId,
      isAccept,
      motivos,
      isAccept ? undefined : comentariosRechazo,
      registerInErp
    );

    if (res.success && res.fileData) {
      handleDownload(res.fileData, res.filename);
      toast.success(
        isAccept
          ? `Aceptación E2_15 descargada y consulta resuelta`
          : `Rechazo E2_15 descargado y consulta resuelta`
      );
      setSelectedEventId(null);
      await fetchPending();
    } else {
      toast.error(res.error || 'Error generando respuesta E2_15');
    }
    setLoading(false);
  };

  const handleGenerateE2_01 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await generateE2_01(cups, codigoRef, tipoReposicion, registerInErp);
    if (res.success && res.fileData) {
      handleDownload(res.fileData, res.filename);
      toast.success(
        registerInErp
          ? `ZIP ${res.filename} descargado y E2_01 registrado en el ERP`
          : `ZIP ${res.filename} descargado`
      );
      setCups('');
      setCodigoRef('');
      setCupsContext(null);
    } else {
      toast.error(res.error || 'Error generando solicitud E2_01');
    }
    setLoading(false);
  };

  const formatEventDate = (event: any) => {
    const raw = event.fechaSolicitud || event.createdAt;
    if (!raw) return '-';
    try {
      return new Date(raw).toLocaleDateString('es-ES');
    } catch {
      return '-';
    }
  };

  const getMotivoLabel = (event: any) => {
    const cod = event.tipoReposicionClean || '';
    if (cod === '01') return '01 - Contratación indebida (Sin consentimiento)';
    if (cod === '02') return '02 - Error administrativo';
    if (cod === '03') return '03 - Solicitada por comercializador saliente';
    return cod || 'No especificado';
  };

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar
        title="Reposiciones (E2)"
        subtitle="Gestiona consultas recibidas (E2_14 -> E2_15) y genera solicitudes de reposición (E2_01) conforme a CNMC V3.0."
      />

      <div className="p-6 w-full max-w-[1600px] mx-auto space-y-6 flex-1">
        {/* Tabs */}
        <div className="flex space-x-2 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('recibidas')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'recibidas'
                ? 'border-[var(--lime)] text-[var(--lime)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={{
              borderColor: activeTab === 'recibidas' ? theme.accentColor : 'transparent',
              color: activeTab === 'recibidas' ? theme.accentColor : undefined,
            }}
          >
            Consultas Recibidas (E2_14) ({pendingEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('solicitar')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'solicitar'
                ? 'border-[var(--lime)] text-[var(--lime)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={{
              borderColor: activeTab === 'solicitar' ? theme.accentColor : 'transparent',
              color: activeTab === 'solicitar' ? theme.accentColor : undefined,
            }}
          >
            Solicitar Reposición (E2_01)
          </button>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] p-6 shadow-xl">
          {activeTab === 'recibidas' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                  <AlertCircle className="w-5 h-5 text-amber-500" /> Consultas Pendientes de Respuesta (Paso 15)
                </h2>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={registerInErp}
                    onChange={e => setRegisterInErp(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[var(--lime)]"
                  />
                  Auto-registrar respuesta `E2_15` en el ERP
                </label>
              </div>

              {loading && pendingEvents.length === 0 ? (
                <div className="flex justify-center p-8">
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-b-2"
                    style={{ borderColor: theme.accentColor }}
                  ></div>
                </div>
              ) : pendingEvents.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-xl border border-dashed border-[var(--border)]">
                  No hay consultas de reposición pendientes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--bg-base)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-3 font-medium rounded-tl-lg">CUPS</th>
                        <th className="px-4 py-3 font-medium">Contrato</th>
                        <th className="px-4 py-3 font-medium">F. Solicitud</th>
                        <th className="px-4 py-3 font-medium">Cód. Solicitud Distribuidora</th>
                        <th className="px-4 py-3 font-medium">Motivo (Tabla 135)</th>
                        <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                      {pendingEvents.map(event => (
                        <tr key={event.id} className="hover:bg-[var(--bg-base)] transition-colors align-top">
                          <td className="px-4 py-4 font-mono text-xs">{event.supplyPoint?.cups || 'Desconocido'}</td>
                          <td className="px-4 py-4 font-mono text-xs">
                            {event.contract?.id && event.contract?.contractCode ? (
                              <Link href={`/contratos/${event.contract.id}`} className="text-[var(--lime)] hover:underline">
                                {event.contract.contractCode}
                              </Link>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-4">{formatEventDate(event)}</td>
                          <td className="px-4 py-4 font-mono">{event.codigoSolicitud || '-'}</td>
                          <td className="px-4 py-4 text-amber-400 font-medium">{getMotivoLabel(event)}</td>
                          <td className="px-4 py-4 text-right">
                            {selectedEventId === event.id ? (
                              <div className="flex flex-col gap-2 items-end max-w-md ml-auto bg-[var(--bg-base)] p-3 rounded-xl border border-[var(--border)] text-left">
                                <div className="w-full">
                                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                                    Motivo Rechazo (Tabla 27 CNMC)
                                  </label>
                                  <select
                                    value={motivoSelect}
                                    onChange={e => setMotivoSelect(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-white"
                                  >
                                    {MOTIVOS_RECHAZO_E2_15.map(opt => (
                                      <option key={opt.codigo} value={opt.codigo}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {motivoSelect === 'OTRO' && (
                                  <div className="w-full">
                                    <input
                                      type="text"
                                      maxLength={2}
                                      placeholder="Código 2 caracteres (ej. G8)"
                                      className="w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs font-mono uppercase text-white"
                                      value={customMotivo}
                                      onChange={e => setCustomMotivo(e.target.value.toUpperCase())}
                                    />
                                  </div>
                                )}
                                <div className="w-full">
                                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                                    Comentarios del rechazo (XSD obligatorio)
                                  </label>
                                  <textarea
                                    rows={2}
                                    maxLength={4000}
                                    value={comentariosRechazo}
                                    onChange={e => setComentariosRechazo(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-white"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end w-full pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEventId(null)}
                                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:underline"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => handleRespond(event.id, false)}
                                    className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-md text-xs font-semibold transition-colors"
                                  >
                                    Confirmar y Descargar Rechazo
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                {event.fullXmlUrl && (
                                  <a
                                    href={event.fullXmlUrl}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors text-xs"
                                    title="Descargar XML Original"
                                  >
                                    <Download className="w-4 h-4" /> XML
                                  </a>
                                )}
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={() => handleRespond(event.id, true)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-[var(--lime-glow)] text-[var(--lime)] hover:bg-[var(--lime-glow-lg)] border border-[var(--lime-glow)] rounded-lg transition-colors text-xs font-semibold"
                                  style={{ color: theme.accentColor, borderColor: theme.accentColor }}
                                >
                                  <CheckCircle className="w-4 h-4" /> Aceptar
                                </button>
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={() => openRejectForm(event.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors text-xs font-semibold"
                                >
                                  <XCircle className="w-4 h-4" /> Rechazar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'solicitar' && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-6 text-[var(--text-primary)]">
                <FileText className="w-5 h-5 text-blue-500" /> Generar Solicitud de Reposición (`E2_01`)
              </h2>
              <form onSubmit={handleGenerateE2_01} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">CUPS</label>
                    {fetchingCupsContext && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando bajas recientes...
                      </span>
                    )}
                  </div>
                  <input
                    required
                    type="text"
                    maxLength={22}
                    placeholder="ES0000000000000000XX0F"
                    className="w-full px-4 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] font-mono uppercase focus:border-[var(--lime)] outline-none transition-all"
                    value={cups}
                    onChange={e => setCups(e.target.value.toUpperCase().trim())}
                  />
                </div>

                {cupsContext && !cupsContext.notFound && cupsContext.titular && (
                  <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {cupsContext.titular}{' '}
                            <span className="text-xs font-mono text-slate-400">({cupsContext.nif || 'Sin NIF'})</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            CUPS: <span className="font-mono text-slate-300">{cupsContext.cupsFull}</span>
                            {cupsContext.contractStatus ? ` · Último estado: ${cupsContext.contractStatus}` : ''}
                          </div>
                        </div>
                      </div>
                      {cupsContext.contractId && cupsContext.contractCode && (
                        <Link
                          href={`/contratos/${cupsContext.contractId}`}
                          className="text-xs font-mono text-[var(--lime)] hover:underline"
                        >
                          {cupsContext.contractCode}
                        </Link>
                      )}
                    </div>

                    {cupsContext.recentLosses && cupsContext.recentLosses.length > 0 && (
                      <div className="pt-2 border-t border-emerald-500/15 space-y-1.5">
                        <div className="text-[11px] font-semibold text-[var(--lime)] uppercase tracking-wider flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> Bajas salientes detectadas (clic para usar su Código de Solicitud)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cupsContext.recentLosses.map(loss => (
                            <button
                              key={`${loss.proceso}_${loss.codigoSolicitud}`}
                              type="button"
                              onClick={() => {
                                setCodigoRef(loss.codigoSolicitud);
                                toast.success(`Código ${loss.codigoSolicitud} aplicado`);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-base)] hover:border-[var(--lime)] border border-[var(--border)] text-xs text-left transition-colors"
                            >
                              <span className="font-bold text-[var(--lime)] font-mono">
                                {loss.proceso}_{loss.paso}
                              </span>{' '}
                              · <span className="font-mono text-white">{loss.codigoSolicitud}</span>
                              {loss.fecha ? <span className="text-slate-400"> ({loss.fecha})</span> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {cupsContext?.notFound && cups.length >= 20 && !fetchingCupsContext && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    CUPS no encontrado en la comercializadora activa.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                    Código de Solicitud a Reponer (12 dígitos)
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={12}
                    placeholder="Ej. 202600001885"
                    className="w-full px-4 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:border-[var(--lime)] outline-none transition-all"
                    value={codigoRef}
                    onChange={e => setCodigoRef(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">
                    Tipo de Reposición (Tabla 135 CNMC)
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--lime)] outline-none transition-all"
                    value={tipoReposicion}
                    onChange={e => setTipoReposicion(e.target.value)}
                  >
                    <option value="01">01 - Contratación indebida (Sin consentimiento)</option>
                    <option value="02">02 - Error administrativo (Ej. error en CUPS)</option>
                    <option value="03">03 - Solicitada por comercializador saliente</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={registerInErp}
                    onChange={e => setRegisterInErp(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[var(--lime)]"
                  />
                  <span className="text-sm text-slate-300">
                    Registrar automáticamente la solicitud `E2_01` en el ERP (Eventos Switchings y R2)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-[var(--bg-base)] font-semibold shadow-[0_0_15px_var(--lime-glow)] hover:shadow-[0_0_25px_var(--lime-glow-lg)] transition-all disabled:opacity-50 disabled:pointer-events-none mt-4"
                  style={{ background: theme.accentColor }}
                >
                  {loading ? 'Generando ZIP...' : 'Generar Solicitud de Reposición'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
