'use client';

import { useState, useEffect } from 'react';
import { getPendingE2_14, respondToE2_14, generateE2_01 } from '@/app/actions/reposicionesActions';
import { AlertCircle, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useBrandTheme } from '@/context/BrandThemeContext';

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
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            Reposiciones (E2)
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Gestiona y genera solicitudes de reposición</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('recibidas')}
          className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recibidas'
              ? 'border-[var(--brand-color)] text-[var(--brand-color)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          style={{ borderColor: activeTab === 'recibidas' ? theme.accentColor : 'transparent', color: activeTab === 'recibidas' ? theme.accentColor : undefined }}
        >
          Consultas Recibidas (E2_14)
        </button>
        <button
          onClick={() => setActiveTab('solicitar')}
          className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'solicitar'
              ? 'border-[var(--brand-color)] text-[var(--brand-color)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          style={{ borderColor: activeTab === 'solicitar' ? theme.accentColor : 'transparent', color: activeTab === 'solicitar' ? theme.accentColor : undefined }}
        >
          Solicitar Reposición (E2_01)
        </button>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl border border-white/20 dark:border-gray-700 p-6 shadow-xl">
        {activeTab === 'recibidas' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Consultas Pendientes de Respuesta
            </h2>
            
            {loading && pendingEvents.length === 0 ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : pendingEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                No hay consultas de reposición pendientes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-tl-lg">CUPS</th>
                      <th className="px-4 py-3 font-medium">F. Solicitud</th>
                      <th className="px-4 py-3 font-medium">Cód. Solicitud Distribuidora</th>
                      <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pendingEvents.map(event => (
                      <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-4 font-medium">{event.supplyPoint?.cups || 'Desconocido'}</td>
                        <td className="px-4 py-4">{new Date(event.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-4">{event.codigoSolicitud || '-'}</td>
                        <td className="px-4 py-4 text-right">
                          {selectedEventId === event.id ? (
                            <div className="flex flex-col gap-2 items-end">
                              <input 
                                type="text"
                                placeholder="Motivo rechazo (ej. 01)"
                                className="px-2 py-1 border rounded text-sm w-32"
                                value={motivoRechazo}
                                onChange={e => setMotivoRechazo(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button onClick={() => setSelectedEventId(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                                <button onClick={() => handleRespond(event.id, false)} className="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded-md text-xs font-medium transition-colors">Confirmar Rechazo</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleRespond(event.id, true)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" /> Aceptar
                              </button>
                              <button 
                                onClick={() => setSelectedEventId(event.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
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
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-blue-500" /> Generar Solicitud E2_01
            </h2>
            <form onSubmit={handleGenerateE2_01} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">CUPS</label>
                <input
                  required
                  type="text"
                  placeholder="ES00000000000000000000"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 focus:ring-2 outline-none transition-all"
                  value={cups}
                  onChange={e => setCups(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Código Solicitud a Reponer</label>
                <input
                  required
                  type="text"
                  placeholder="Ej. 123456789012"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 focus:ring-2 outline-none transition-all"
                  value={codigoRef}
                  onChange={e => setCodigoRef(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo de Reposición (Tabla 135)</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 focus:ring-2 outline-none transition-all"
                  value={tipoReposicion}
                  onChange={e => setTipoReposicion(e.target.value)}
                >
                  <option value="01">01 - Por Error</option>
                  <option value="02">02 - Sin consentimiento</option>
                  <option value="03">03 - Otro (ver tabla 135)</option>
                </select>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
                style={{ background: theme.accentColor }}
              >
                {loading ? 'Generando ZIP...' : 'Generar Solicitud de Reposición'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
