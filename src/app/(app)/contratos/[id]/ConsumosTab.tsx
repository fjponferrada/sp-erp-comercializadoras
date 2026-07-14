import React, { useState } from 'react';
import { Download, AlertCircle, Zap } from 'lucide-react';
import { format, startOfYear, endOfToday } from 'date-fns';

export default function ConsumosTab({ cups }: { cups?: string }) {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfToday(), 'yyyy-MM-dd'));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!cups) {
      setError('No hay CUPS asociado a este contrato.');
      return;
    }
    setError(null);
    setDownloading(true);

    try {
      const res = await fetch(`/api/cch/export?cups=${encodeURIComponent(cups)}&start=${startDate}&end=${endDate}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al descargar la curva');
      }

      // Descargar el fichero
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition if present, or use default
      const disposition = res.headers.get('content-disposition');
      let filename = `curva_${cups}_${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}.csv`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (!cups) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-[var(--border-strong)] rounded-2xl bg-[var(--bg-elevated)] animate-fade-in-up">
        <AlertCircle size={48} className="text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Falta CUPS</h2>
        <p className="text-gray-400 text-center max-w-md">
          Este contrato no tiene un CUPS asociado o aún no ha sido cargado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 border border-[var(--border-strong)] rounded-2xl bg-[var(--bg-elevated)] animate-fade-in-up min-w-0">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-primary-500/10 rounded-lg">
          <Zap className="text-primary-400 w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Curva de Carga Horaria (CCH)</h2>
          <p className="text-sm text-slate-400">Descarga el histórico de consumos horarios para el CUPS {cups}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Desde</label>
          <input 
            type="date" 
            className="form-input w-full"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Hasta</label>
          <input 
            type="date" 
            className="form-input w-full"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <button 
            onClick={handleDownload} 
            disabled={downloading}
            className="btn-primary w-full flex items-center justify-center py-2.5"
          >
            {downloading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <Download className="w-5 h-5 mr-2" />
            )}
            Consultar CCH
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
