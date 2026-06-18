'use client';

import { useState } from 'react';
import { Download, Loader2, Building2 } from 'lucide-react';
import Topbar from '@/components/Topbar';

export default function MitecoClient() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('ESCILA');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dafneResult, setDafneResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (reportType === 'DAFNE') {
      // DAFNE is pending development
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/miteco/escila?year=${year}`);
      if (!response.ok) throw new Error('Error al generar informe ESCILA');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESCILA_AED_${year}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      alert('Informe ESCILA generado correctamente');
    } catch (error: any) {
      alert(error.message || 'Error al generar el informe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Reportes MITECO" subtitle="Generación de informes regulatorios para el Ministerio" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
        <div className="card animate-fade-in-up" style={{ padding: '32px' }}>
          <div className="space-y-6">
            
            <div className="space-y-2 max-w-xl">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Seleccione el reporte a generar:</label>
              <select 
              value={reportType} 
              onChange={(e) => {
                setReportType(e.target.value);
                setDafneResult(null);
              }}
                className="form-input"
            >
              <option value="ESCILA">ESCILA (XML Sectores)</option>
              <option value="DAFNE">DAFNE</option>
            </select>
          </div>

            <div className="flex items-end justify-between max-w-xl">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Especifique el año de reporte:</label>
                <select 
                  value={year} 
                  onChange={(e) => setYear(e.target.value)}
                  className="form-input"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>

              {reportType === 'DAFNE' && (
                <div className="flex items-center ml-4">
                  <span className="badge badge-draft text-xs px-2 py-1">
                    Pendiente de desarrollo (Requiere curvas de carga)
                  </span>
                </div>
              )}
          </div>

            <div className="pt-4 border-t border-slate-700/50 flex justify-end">
              <button 
                onClick={handleGenerate} 
                disabled={loading || reportType === 'DAFNE'}
                className="btn-primary"
                style={{ padding: '12px 24px' }}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Download className="mr-2 h-5 w-5" />
                )}
              {reportType === 'ESCILA' ? 'Descargar XML' : 'Consultar Datos'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
