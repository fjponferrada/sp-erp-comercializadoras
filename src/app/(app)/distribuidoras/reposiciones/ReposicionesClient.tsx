'use client';

import { useState, useEffect } from 'react';
import { getPendingE2_14, respondToE2_14, generateE2_01 } from '@/app/actions/reposicionesActions';
import { AlertCircle, FileText, CheckCircle, XCircle, Download } from 'lucide-react';
import { useBrandTheme } from '@/context/BrandThemeContext';
import Topbar from '@/components/Topbar';

export default function ReposicionesClient() {
  const [activeTab, setActiveTab] = useState<'recibidas' | 'solicitar'>('recibidas');
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const theme = useBrandTheme();

  // Form states for E2_01
  const [cups, setCups] = useState('');
  const [codigoRef, setCodigoRef] = useState('');
  const [tipoReposicion, setTipoReposicion] = useState('135'); // Por defecto error
  
  // State for E2_15 response
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    const res = await getPendingE2_14();
    if (res.success && res.data) {
      setPendingEvents(res.data);
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

  const handleRespond = async (eventId: string, isAccept: boolean) => {
    if (!isAccept && !motivoRechazo) {
      alert("Debes indicar un motivo de rechazo.");
      return;
    }
    
    setLoading(true);
    const motivos = isAccept ? undefined : [motivoRechazo];
    const res = await respondToE2_14(eventId, isAccept, motivos);
    
    if (res.success && res.fileData) {
      handleDownload(res.fileData, res.filename);
      setSelectedEventId(null);
      setMotivoRechazo('');
      await fetchPending(); // Refresh list
    } else {
      alert("Error: " + res.error);
    }
    setLoading(false);
  };

  const handleGenerateE2_01 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await generateE2_01(cups, codigoRef, tipoReposicion);
    if (res.success && res.fileData) {
      handleDownload(res.fileData, res.filename);
      setCups('');
      setCodigoRef('');
    } else {
      alert("Error: " + res.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar 
        title="Reposiciones (E2)"
        subtitle="Gestiona y genera solicitudes de reposición en el sistema de switching."
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
              color: activeTab === 'recibidas' ? theme.accentColor : undefined 
            }}
          >
            Consultas Recibidas (E2_14)
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
              color: activeTab === 'solicitar' ? theme.accentColor : undefined 
            }}
          >
            Solicitar Reposición (E2_01)
          </button>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] p-6 shadow-xl">
          {activeTab === 'recibidas' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Consultas Pendientes de Respuesta
              </h2>
              
              {loading && pendingEvents.length === 0 ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: theme.accentColor }}></div>
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
                        <th className="px-4 py-3 font-medium">F. Solicitud</th>
                        <th className="px-4 py-3 font-medium">Cód. Solicitud Distribuidora</th>
                        <th className="px-4 py-3 font-medium">Motivo (Tabla 135)</th>
                        <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                      {pendingEvents.map(event => {
                        const getMotivoLabel = (cod: string) => {
                          if (cod === '01') return '01 - Contratación indebida (Sin consentimiento)';
                          if (cod === '02') return '02 - Error administrativo';
                          if (cod === '03') return '03 - Solicitada por comercializador saliente';
                          return cod || 'No especificado';
                        };
                        return (
                        <tr key={event.id} className="hover:bg-[var(--bg-base)] transition-colors">
                          <td className="px-4 py-4 font-medium">{event.supplyPoint?.cups || 'Desconocido'}</td>
                          <td className="px-4 py-4">{new Date(event.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-4">{event.codigoSolicitud || '-'}</td>
                          <td className="px-4 py-4 text-amber-500 font-medium">
                            {getMotivoLabel(event.observaciones)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {selectedEventId === event.id ? (
                              <div className="flex flex-col gap-2 items-end">
                                <input 
                                  type="text"
                                  placeholder="Motivo rechazo (ej. 01)"
                                  className="px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded text-sm w-40 outline-none focus:border-[var(--lime)]"
                                  value={motivoRechazo}
                                  onChange={e => setMotivoRechazo(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => setSelectedEventId(null)} className="text-xs text-[var(--text-secondary)] hover:underline">Cancelar</button>
                                  <button onClick={() => handleRespond(event.id, false)} className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-md text-xs font-medium transition-colors">Confirmar Rechazo</button>
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
                                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors"
                                      title="Descargar XML Original"
                                    >
                                      <Download className="w-4 h-4" /> XML
                                    </a>
                                  )}
                                  <button 
                                    onClick={() => handleRespond(event.id, true)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[var(--lime-glow)] text-[var(--lime)] hover:bg-[var(--lime-glow-lg)] border border-[var(--lime-glow)] rounded-lg transition-colors"
                                    style={{ color: theme.accentColor, borderColor: theme.accentColor }}
                                  >
                                    <CheckCircle className="w-4 h-4" /> Aceptar
                                  </button>
                                  <button 
                                    onClick={() => setSelectedEventId(event.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                                  >
                                    <XCircle className="w-4 h-4" /> Rechazar
                                  </button>
                                </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        {activeTab === 'solicitar' && (
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-6 text-[var(--text-primary)]">
              <FileText className="w-5 h-5 text-blue-500" /> Generar Solicitud E2_01
            </h2>
            <form onSubmit={handleGenerateE2_01} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">CUPS</label>
                <input
                  required
                  type="text"
                  placeholder="ES00000000000000000000"
                  className="w-full px-4 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--lime)] outline-none transition-all"
                  style={{ borderFocusColor: theme.accentColor } as any}
                  value={cups}
                  onChange={e => setCups(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Código Solicitud a Reponer</label>
                <input
                  required
                  type="text"
                  placeholder="Ej. 123456789012"
                  className="w-full px-4 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--lime)] outline-none transition-all"
                  value={codigoRef}
                  onChange={e => setCodigoRef(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--text-secondary)]">Tipo de Reposición (Tabla 135)</label>
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
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-[var(--bg-base)] font-medium shadow-[0_0_15px_var(--lime-glow)] hover:shadow-[0_0_25px_var(--lime-glow-lg)] transition-all disabled:opacity-50 disabled:pointer-events-none mt-4"
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
