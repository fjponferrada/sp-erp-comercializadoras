'use client';

import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { generateAnulacionXml, fetchAnulacionContext } from '@/app/actions/anulacionesActions';
import Topbar from '@/components/Topbar';

export default function GenerarAnulacionClient() {
  const [formData, setFormData] = useState({
    emisora: '',
    destino: '',
    proceso: 'C1',
    codigoSolicitud: '',
    cups: '',
  });

  const [loading, setLoading] = useState(false);
  const [fetchingContext, setFetchingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch context when component mounts (for emisora) and when CUPS length > 10 (for destino)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchContext = async () => {
      setFetchingContext(true);
      try {
        const res = await fetchAnulacionContext(formData.cups);
        if (res.success) {
          setFormData((prev) => ({
            ...prev,
            emisora: prev.emisora || res.emisora || '',
            destino: res.destino || prev.destino || '',
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetchingContext(false);
      }
    };

    if (formData.cups.length > 10 || formData.emisora === '') {
      timeoutId = setTimeout(fetchContext, 500);
    }

    return () => clearTimeout(timeoutId);
  }, [formData.cups]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.codigoSolicitud || !formData.cups || !formData.destino) {
        throw new Error('Por favor, rellena todos los campos (Destino, Código Solicitud, CUPS).');
      }

      const response = await generateAnulacionXml(formData);

      if (!response.success) {
        throw new Error(response.error || 'Error desconocido al generar XML');
      }

      // Download file
      const blob = new Blob([response.xml as string], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Filename: [Proceso]_[Paso]_[CodigoSolicitud].xml
      let paso = '08';
      if (formData.proceso === 'A3' || formData.proceso === 'M1') paso = '06';
      else if (formData.proceso === 'B1') paso = '03';

      link.setAttribute('download', `${formData.proceso}_${paso}_${formData.codigoSolicitud}.xml`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Generar Anulación" subtitle="Genera ficheros XML de anulación para procesos de Switching en curso." />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="card animate-fade-in-up" style={{ padding: '32px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Emisora (Código REE)
            </label>
            <input
              type="text"
              value={formData.emisora}
              onChange={(e) => handleChange('emisora', e.target.value)}
              className="form-input"
              placeholder="Ej: 1713"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Destino (Código REE)
            </label>
            <input
              type="text"
              value={formData.destino}
              onChange={(e) => handleChange('destino', e.target.value)}
              className="form-input"
              placeholder="Ej: 0031"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Proceso a Anular
            </label>
            <select
              value={formData.proceso}
              onChange={(e) => handleChange('proceso', e.target.value)}
              className="form-input"
            >
              <option value="C1">C1 - Cambio de Comercializador (Paso 08)</option>
              <option value="C2">C2 - Cambio de Comercializador con modificaciones (Paso 08)</option>
              <option value="A3">A3 - Alta de Suministro (Paso 06)</option>
              <option value="M1">M1 - Modificación Contractual (Paso 06)</option>
              <option value="B1">B1 - Baja de Suministro (Paso 03)</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Código de Solicitud
            </label>
            <input
              type="text"
              value={formData.codigoSolicitud}
              onChange={(e) => handleChange('codigoSolicitud', e.target.value)}
              className="form-input"
              placeholder="Ej: 249999413591"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              CUPS
            </label>
            <input
              type="text"
              value={formData.cups}
              onChange={(e) => handleChange('cups', e.target.value)}
              className="form-input uppercase"
              placeholder="ES..."
              maxLength={22}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary"
            style={{ padding: '12px 24px' }}
          >
            <Download className="w-5 h-5" />
            {loading ? 'Generando...' : 'Generar y Descargar XML'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
