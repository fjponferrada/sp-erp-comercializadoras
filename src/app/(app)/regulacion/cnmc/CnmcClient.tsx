'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { Info, ExternalLink, Download, FileBarChart2, CalendarDays, Activity, Loader2 } from 'lucide-react';
import { useBrandTheme } from '@/context/BrandThemeContext';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { id: 'SI_CODAGE', name: 'SI Codage', desc: 'Sistema de Información de Consumos' },
  { id: 'TM_CODAGE', name: 'TM Codage', desc: 'Telemedida y Curvas de Carga' },
  { id: 'IVC_CODAGE', name: 'IVC Codage', desc: 'Índices de Validación y Calidad' },
];

export default function CnmcClient() {
  const brand = useBrandTheme();
  const [opcion, setOpcion] = useState('');
  const [mes, setMes] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!opcion) {
      toast.error('Selecciona un tipo de reporte');
      return;
    }
    
    setIsLoading(true);
    try {
      if (opcion === 'SI_CODAGE') {
        if (!mes) {
          toast.error('Debes seleccionar un mes para SI Codage');
          return;
        }

        const response = await fetch(`/api/cnmc/si-codage?mes=${mes}`, {
          method: 'GET'
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al generar el XML');
        }

        // Trigger file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from header or fallback
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'SI_CODAGE.xml';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) filename = match[1];
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Fichero ${filename} generado correctamente`);
        setShowModal(true);
      } else if (opcion === 'TM_CODAGE') {
        if (!mes) {
          toast.error('Debes seleccionar un mes para TM Codage');
          return;
        }

        const response = await fetch(`/api/cnmc/tm-codage?mes=${mes}`, {
          method: 'GET'
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al generar el CSV');
        }

        // Trigger file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from header or fallback
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'TM_CODAGE.csv';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) filename = match[1];
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`Fichero ${filename} generado correctamente`);
        setShowModal(true);
      } else {
        // Placeholder for IVC_CODAGE logic
        setTimeout(() => {
          setShowModal(true);
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  // Inicializar el mes actual
  useEffect(() => {
    const date = new Date();
    // Formato YYYY-MM
    setMes(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Reportes CNMC" subtitle="Generación de modelos oficiales para la CNMC" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
        <div className="card animate-fade-in-up" style={{ padding: '32px' }}>
          <div className="space-y-6">

            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Selecciona el tipo de reporte:</label>
              <button 
                onClick={() => setShowModal(true)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
              >
                <span>ENTREGAR MODELO</span>
                <ExternalLink size={14} />
              </button>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {REPORT_TYPES.map((type) => {
                const isSelected = opcion === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setOpcion(type.id)}
                    className={`relative p-4 text-left rounded-xl border transition-all duration-300 ${
                      isSelected 
                        ? 'bg-[var(--lime)]/10 border-[var(--lime)]/50 text-[var(--lime)]' 
                        : 'bg-slate-900 border-slate-700 text-white hover:border-slate-500'
                    }`}
                  >
                    <h3 className="text-sm font-bold mb-1">{type.name}</h3>
                    <p className={`text-xs ${isSelected ? 'text-[var(--lime)]/70' : 'text-slate-400'}`}>{type.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Parámetros Dinámicos */}
            {opcion === 'SI_CODAGE' && (
              <div className="flex items-end max-w-xl gap-4 animate-fade-in-up">
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Especifique el mes de reporte:</label>
                  <input
                    type="month"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {opcion === 'TM_CODAGE' && (
              <div className="flex items-end max-w-xl gap-4 animate-fade-in-up">
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Trimestre a reportar (Mes):</label>
                  <input
                    type="month"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {opcion === 'IVC_CODAGE' && (
              <div className="flex items-end max-w-xl gap-4 animate-fade-in-up">
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Desde:</label>
                  <input
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Hasta:</label>
                  <input
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-700/50 flex justify-end">
              <button 
                onClick={handleGenerate} 
                disabled={isLoading || !opcion}
                className="btn-primary"
                style={{ padding: '12px 24px' }}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-black" />
                ) : (
                  <Download className="mr-2 h-5 w-5" />
                )}
                {isLoading ? 'GENERANDO...' : 'GENERAR REPORTE'}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Modal del enlace */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Info size={32} className="text-blue-400" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-white text-center mb-4">
              Portal de Trámites CNMC
            </h3>
            
            <p className="text-center text-white/60 text-sm mb-8">
              El reporte generado deberá ser entregado directamente en la sede electrónica de la CNMC a través del siguiente enlace oficial:
            </p>
            
            <div className="bg-black/50 rounded-xl p-4 mb-8 border border-white/5 text-center">
              <a 
                href="https://tramites.cnmc.gob.es/formulario/4" 
                target="_blank" 
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-2 group transition-colors text-lg"
              >
                Enlace SI CODAGE
                <ExternalLink size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </a>
            </div>
            
            <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10 text-xs text-white/50 text-left leading-relaxed">
              *El número que aparece al final del nombre del archivo identifica la versión de la entrega. Utilice &quot;01&quot; para la presentación inicial y actualice la numeración de forma correlativa (&quot;02&quot;, &quot;03&quot;, etc.) en caso de realizar correcciones o nuevas entregas del modelo.
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={() => setShowModal(false)}
                className="w-full py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors border border-white/10"
              >
                Entendido, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
