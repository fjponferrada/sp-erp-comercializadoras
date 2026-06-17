'use client';

import { useState } from 'react';
import { Download, Loader2, Building2 } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="text-rose-500" />
            Reportes MITECO
          </h1>
          <p className="text-slate-400 mt-1">Generación de informes regulatorios para el Ministerio</p>
        </div>
      </div>
      
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 max-w-4xl">
        <div className="space-y-6">
          
          <div className="space-y-2 max-w-xl">
            <label className="block text-sm font-medium text-slate-300">Seleccione el reporte a generar:</label>
            <select 
              value={reportType} 
              onChange={(e) => {
                setReportType(e.target.value);
                setDafneResult(null);
              }}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-slate-900 border-slate-700 text-white focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm rounded-md"
            >
              <option value="ESCILA">ESCILA (XML Sectores)</option>
              <option value="DAFNE">DAFNE</option>
            </select>
          </div>

          <div className="flex items-end justify-between max-w-xl">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Especifique el año de reporte:</label>
              <select 
                value={year} 
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 block w-32 pl-3 pr-10 py-2 text-base bg-slate-900 border-slate-700 text-white focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm rounded-md"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>

            {reportType === 'DAFNE' && (
              <div className="flex items-center ml-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Pendiente de desarrollo (Requiere curvas de carga)
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-700/50 flex justify-end">
            <button 
              onClick={handleGenerate} 
              disabled={loading || reportType === 'DAFNE'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {reportType === 'ESCILA' ? 'Descargar XML' : 'Consultar Datos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
