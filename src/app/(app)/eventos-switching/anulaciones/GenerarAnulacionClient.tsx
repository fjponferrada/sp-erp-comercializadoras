'use client';

import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Loader2, Zap } from 'lucide-react';
import {
  generateAnulacionXml,
  fetchAnulacionContext,
  OpenAnulableProcess,
} from '@/app/actions/anulacionesActions';
import Topbar from '@/components/Topbar';
import toast from 'react-hot-toast';

export default function GenerarAnulacionClient() {
  const [formData, setFormData] = useState({
    emisora: '',
    destino: '',
    proceso: 'C1',
    codigoSolicitud: '',
    cups: '',
  });
  const [registerInErp, setRegisterInErp] = useState(true);
  const [openProcesses, setOpenProcesses] = useState<OpenAnulableProcess[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetchingContext, setFetchingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchContext = async () => {
      setFetchingContext(true);
      try {
        const res = await fetchAnulacionContext(formData.cups);
        if (res.success) {
          setFormData(prev => ({
            ...prev,
            emisora: prev.emisora || res.emisora || '',
            destino: res.destino || prev.destino || '',
          }));
          setOpenProcesses(res.openProcesses || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetchingContext(false);
      }
    };

    if (formData.cups.length >= 16 || formData.emisora === '') {
      timeoutId = setTimeout(fetchContext, 400);
    } else {
      setOpenProcesses([]);
    }

    return () => clearTimeout(timeoutId);
  }, [formData.cups]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applySuggestedProcess = (item: OpenAnulableProcess) => {
    setFormData(prev => ({
      ...prev,
      proceso: item.proceso,
      codigoSolicitud: item.codigoSolicitud,
      cups: item.cups || prev.cups,
      destino: item.destino || prev.destino,
    }));
    toast.success(`Solicitud ${item.proceso} (${item.codigoSolicitud}) cargada`);
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.codigoSolicitud || !formData.cups || !formData.destino) {
        throw new Error('Por favor, rellena todos los campos (Destino, Código Solicitud, CUPS).');
      }

      const response = await generateAnulacionXml({
        ...formData,
        registerInErp,
      });

      if (!response.success) {
        throw new Error(response.error || 'Error desconocido al generar XML');
      }

      const blob = new Blob([response.xml as string], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const paso =
        response.paso ||
        (formData.proceso === 'A3' || formData.proceso === 'M1'
          ? '06'
          : formData.proceso === 'B1' || formData.proceso === 'E1'
            ? '03'
            : '08');

      const downloadName = response.filename || `${formData.proceso}_${paso}_${formData.codigoSolicitud}.xml`;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast.success(
        registerInErp
          ? `XML ${downloadName} descargado y registrado en Eventos Switchings`
          : `XML ${downloadName} descargado`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Generar Anulación"
        subtitle="Genera ficheros XML de anulación (CNMC V3.0) para procesos de Switching y Reclamaciones en curso."
      />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="card animate-fade-in-up" style={{ padding: '32px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  CUPS
                </label>
                {fetchingContext && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando solicitudes abiertas...
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.cups}
                onChange={e => handleChange('cups', e.target.value.toUpperCase().trim())}
                className="form-input uppercase font-mono"
                placeholder="Introduce el CUPS (ES...) para autocompletar distribuidora y solicitudes en curso"
                maxLength={22}
              />
            </div>

            {openProcesses.length > 0 && (
              <div className="md:col-span-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-[var(--lime)] uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Solicitudes en curso detectadas para este CUPS (clic para autocompletar)
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {openProcesses.map(proc => (
                    <button
                      key={`${proc.proceso}_${proc.codigoSolicitud}`}
                      type="button"
                      onClick={() => applySuggestedProcess(proc)}
                      className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--lime)] border border-[var(--border)] text-left transition-colors"
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(222,255,154,0.12)] text-[var(--lime)] font-mono">
                          {proc.proceso}
                        </span>
                        <span className="font-mono">{proc.codigoSolicitud}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {proc.sourceLabel}
                        {proc.fechaSolicitud ? ` · ${proc.fechaSolicitud}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Emisora (Código REE)
              </label>
              <input
                type="text"
                maxLength={4}
                value={formData.emisora}
                onChange={e => handleChange('emisora', e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="form-input font-mono"
                placeholder="Ej: 1713"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Destino (Código REE Distribuidora)
              </label>
              <input
                type="text"
                maxLength={4}
                value={formData.destino}
                onChange={e => handleChange('destino', e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="form-input font-mono"
                placeholder="Ej: 0031"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Proceso a Anular
              </label>
              <select
                value={formData.proceso}
                onChange={e => handleChange('proceso', e.target.value)}
                className="form-input"
              >
                <option value="C1">C1 - Cambio de Comercializador (Paso 08)</option>
                <option value="C2">C2 - Cambio de Comercializador con modificaciones (Paso 08)</option>
                <option value="A3">A3 - Alta de Suministro (Paso 06)</option>
                <option value="M1">M1 - Modificación Contractual (Paso 06)</option>
                <option value="B1">B1 - Baja de Suministro (Paso 03)</option>
                <option value="E1">E1 - Desistimiento (Paso 03)</option>
                <option value="E2">E2 - Reposición (Paso 08)</option>
                <option value="R1">R1 - Reclamación (Paso 08)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Código de Solicitud (12 dígitos)
              </label>
              <input
                type="text"
                maxLength={12}
                value={formData.codigoSolicitud}
                onChange={e => handleChange('codigoSolicitud', e.target.value.replace(/\D/g, '').slice(0, 12))}
                className="form-input font-mono"
                placeholder="Ej: 249999413591"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={registerInErp}
                  onChange={e => setRegisterInErp(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[var(--lime)]"
                />
                <span className="text-sm text-slate-300">
                  Registrar automáticamente la solicitud de anulación enviada en el ERP (Eventos Switchings y Cloudflare R2)
                </span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn-primary flex items-center gap-2"
              style={{ padding: '12px 24px' }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              <span>{loading ? 'Generando...' : 'Generar y Descargar XML'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
