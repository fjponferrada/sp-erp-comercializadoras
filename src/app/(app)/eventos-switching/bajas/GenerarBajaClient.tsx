'use client';

import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { fetchBajaContext, generateBajaXml } from '@/app/actions/bajasActions';
import Topbar from '@/components/Topbar';

export default function GenerarBajaClient() {
  const [formData, setFormData] = useState({
    emisora: '',
    destino: '',
    codigoSolicitud: '',
    cups: '',
    motivo: '01',
    fechaPrevista: ''
  });

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

      let finalCodigo = formData.codigoSolicitud;
      if (!finalCodigo && formData.emisora) {
        // El Código de Solicitud debe ser exactamente de 12 dígitos [0-9]{12}
        // Emisora (4 dígitos) + Timestamp/Random (8 dígitos) = 12 dígitos
        const timePart = new Date().getTime().toString().slice(-8);
        finalCodigo = `${formData.emisora.substring(0, 4).padEnd(4, '0')}${timePart}`;
      }

      if (!finalCodigo || !formData.cups || !formData.destino) {
        throw new Error('Por favor, rellena todos los campos obligatorios (Destino, CUPS, etc.).');
      }

      const response = await generateBajaXml({ ...formData, codigoSolicitud: finalCodigo });

      if (!response.success) {
        throw new Error(response.error || 'Error desconocido al generar XML');
      }

      // Download file
      const blob = new Blob([response.xml as string], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      link.setAttribute('download', `B1_01_${finalCodigo}.xml`);
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
      <Topbar title="Generar Baja (B1)" subtitle="Genera ficheros XML de baja o suspensión de suministro eléctrico." />

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
              Motivo de Baja
            </label>
            <select
              value={formData.motivo}
              onChange={(e) => handleChange('motivo', e.target.value)}
              className="form-input"
            >
              <option value="01">01 - Cese de actividad (Baja definitiva)</option>
              <option value="02">02 - Fin de contrato de energía</option>
              <option value="03">03 - Suspensión de suministro por impago (Corte temporal)</option>
              <option value="04">04 - Baja de punto de suministro por impago (Baja definitiva)</option>
            </select>
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

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Fecha de Activación Prevista (Opcional)
            </label>
            <input
              type="date"
              value={formData.fechaPrevista}
              onChange={(e) => handleChange('fechaPrevista', e.target.value)}
              className="form-input"
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            <span style={{ marginLeft: '8px' }}>
              {loading ? 'Generando...' : 'Generar y Descargar XML'}
            </span>
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
