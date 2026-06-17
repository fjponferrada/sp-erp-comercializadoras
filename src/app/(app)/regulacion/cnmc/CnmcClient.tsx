'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { Info, ExternalLink, Download, FileBarChart2, CalendarDays, Activity } from 'lucide-react';
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
    <div className="flex-1 bg-black/40 h-[100vh] overflow-y-auto w-full relative">
      <Topbar title="Reportes CNMC" />

      <div className="p-8 pb-32 max-w-[1000px] mx-auto w-full space-y-8">
        
        {/* Header con enlace */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/[0.02] border border-white/5 p-8 rounded-3xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <FileBarChart2 size={32} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Reportes Regulatorios</h1>
              <p className="text-sm text-white/50 mt-1.5 font-medium">Generación de modelos oficiales para la CNMC</p>
            </div>
          </div>

          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 relative z-10"
          >
            <span>ENTREGAR MODELO</span>
            <ExternalLink size={16} className="text-blue-400" />
          </button>
        </div>

        {/* Tipo de Reporte (Cards) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Activity size={18} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Selecciona el tipo de reporte</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REPORT_TYPES.map((type) => {
              const isSelected = opcion === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setOpcion(type.id)}
                  className={`relative p-6 text-left rounded-2xl border transition-all duration-300 overflow-hidden group ${
                    isSelected 
                      ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.1)] translate-y-[-2px]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'group-hover:opacity-50'}`} />
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className={`text-lg font-bold ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                        {type.name}
                      </h3>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-blue-500' : 'border-white/20'
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </div>
                    </div>
                    <p className={`text-xs font-medium ${isSelected ? 'text-blue-200/70' : 'text-white/40'}`}>
                      {type.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parámetros Dinámicos */}
        {opcion === 'SI_CODAGE' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <CalendarDays size={20} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Período de Facturación</h3>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                    Eligiendo el mes <strong className="text-white">M</strong>, el CRM compilará automáticamente los datos correspondientes. Recuerda que los datos del mes M se entregan el mes <strong className="text-white">M+1</strong> (antes del día 20).
                  </p>
                </div>

                <div className="w-full md:w-auto bg-black/40 p-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-inner">
                  <div className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20">
                    Mes
                  </div>
                  <input
                    type="month"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="bg-transparent border-none px-2 py-2 text-white font-medium text-lg focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {opcion === 'TM_CODAGE' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <CalendarDays size={20} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Trimestre a reportar</h3>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                    Eligiendo un mes, el CRM te facilita los datos del trimestre que contiene ese mes. Por ejemplo, tenga en cuenta que en julio (antes del día 20) deberá entregar el TM_CODAGE del trimestre anterior y por tanto debe consultar <strong className="text-white">Abril</strong>.
                  </p>
                </div>

                <div className="w-full md:w-auto bg-black/40 p-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-inner">
                  <div className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-500/20">
                    Mes
                  </div>
                  <input
                    type="month"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="bg-transparent border-none px-2 py-2 text-white font-medium text-lg focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {opcion === 'IVC_CODAGE' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <CalendarDays size={20} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Rango de Fechas</h3>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Selecciona la fecha de inicio y fin para el cálculo de los índices de validación y calidad.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <div className="bg-black/40 p-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-inner flex-1">
                    <div className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-500/20">
                      Desde
                    </div>
                    <input
                      type="date"
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                      className="bg-transparent border-none px-2 py-2 text-white font-medium focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert w-full"
                    />
                  </div>
                  
                  <div className="bg-black/40 p-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-inner flex-1">
                    <div className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-500/20">
                      Hasta
                    </div>
                    <input
                      type="date"
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                      className="bg-transparent border-none px-2 py-2 text-white font-medium focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert w-full"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-8 flex justify-end animate-in fade-in duration-700">
          <button 
            disabled={!opcion || isLoading}
            onClick={handleGenerate}
            className={`
              flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300
              ${!opcion 
                ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5' 
                : 'bg-white text-black hover:bg-gray-100 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]'
              }
            `}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Download size={20} className={!opcion ? 'opacity-50' : 'animate-bounce-subtle'} />
            )}
            <span>{isLoading ? 'GENERANDO...' : 'GENERAR REPORTE'}</span>
          </button>
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
