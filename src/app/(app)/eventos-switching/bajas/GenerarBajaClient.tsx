'use client';

import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchBajaContext, generateBajaXml, BajaContractPreview } from '@/app/actions/bajasActions';
import Topbar from '@/components/Topbar';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function GenerarBajaClient() {
  const [formData, setFormData] = useState({
    emisora: '',
    destino: '',
    codigoSolicitud: '',
    cups: '',
    motivo: '01',
    fechaPrevista: '',
  });
  const [registerInErp, setRegisterInErp] = useState(true);
  const [preview, setPreview] = useState<BajaContractPreview | null>(null);
  const [cupsNotFound, setCupsNotFound] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetchingContext, setFetchingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchContext = async () => {
      setFetchingContext(true);
      try {
        const res = await fetchBajaContext(formData.cups);
        if (res.success) {
          setFormData(prev => ({
            ...prev,
            emisora: prev.emisora || res.emisora || '',
            destino: res.destino || prev.destino || '',
          }));
          setPreview(res.preview || null);
          setCupsNotFound(Boolean(res.notFound));
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
      setPreview(null);
      setCupsNotFound(false);
    }

    return () => clearTimeout(timeoutId);
  }, [formData.cups]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.cups || !formData.destino || !formData.emisora) {
        throw new Error('Por favor, rellena todos los campos obligatorios (Emisora, Destino y CUPS).');
      }

      const response = await generateBajaXml({
        ...formData,
        registerInErp,
      });

      if (!response.success || !response.xml) {
        throw new Error(response.error || 'Error desconocido al generar XML');
      }

      const blob = new Blob([response.xml], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const downloadName = response.filename || `B1_01_${response.codigoSolicitud || 'solicitud'}.xml`;
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
        title="Generar Baja (B1)"
        subtitle="Genera ficheros XML de baja definitiva o suspensión temporal por impago (CNMC V3.0 Tabla 10)."
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
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando suministro...
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.cups}
                onChange={e => handleChange('cups', e.target.value.toUpperCase().trim())}
                className="form-input uppercase font-mono"
                placeholder="ES..."
                maxLength={22}
              />
            </div>

            {preview && (
              <div className="md:col-span-2 bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-white">
                      {preview.titular}{' '}
                      <span className="text-xs font-mono text-slate-400">({preview.nif || 'Sin NIF'})</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      CUPS: <span className="font-mono text-slate-300">{preview.cupsFull}</span>
                      {preview.tariff ? ` · Tarifa ${preview.tariff}` : ''}
                      {preview.status ? ` · Estado ${preview.status}` : ''}
                    </div>
                  </div>
                </div>
                {preview.contractId && preview.contractCode && (
                  <Link
                    href={`/contratos/${preview.contractId}`}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs font-mono text-[var(--lime)] hover:underline"
                  >
                    Ver contrato {preview.contractCode}
                  </Link>
                )}
              </div>
            )}

            {cupsNotFound && formData.cups.length >= 20 && !fetchingContext && (
              <div className="md:col-span-2 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-center gap-3 text-amber-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>No se ha encontrado un contrato ACTIVO o TRAMITANDO para este CUPS en la comercializadora activa.</span>
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

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Motivo de Baja (Tabla 10 CNMC)
              </label>
              <select
                value={formData.motivo}
                onChange={e => handleChange('motivo', e.target.value)}
                className="form-input"
              >
                <option value="01">01 - Cese de actividad (Baja definitiva)</option>
                <option value="02">02 - Fin de contrato de energía (Baja definitiva)</option>
                <option value="03">03 - Suspensión de suministro por impago (Corte temporal — no extingue contrato)</option>
                <option value="04">04 - Baja de punto de suministro por impago (Baja definitiva)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Fecha de Activación Prevista (Opcional)
              </label>
              <input
                type="date"
                value={formData.fechaPrevista}
                onChange={e => handleChange('fechaPrevista', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Código de Solicitud 12 dígitos (Opcional — autogenerado si vacío)
              </label>
              <input
                type="text"
                maxLength={12}
                value={formData.codigoSolicitud}
                onChange={e => handleChange('codigoSolicitud', e.target.value.replace(/\D/g, '').slice(0, 12))}
                className="form-input font-mono"
                placeholder="Se autogenera automáticamente"
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
                  Registrar automáticamente la solicitud `B1_01` en el ERP (necesario para identificar cortes temporales por impago `Motivo 03` al recibir `B1_05`)
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
