import React from 'react';
import { X, Zap, MapPin, Building, CreditCard, Calendar, BarChart2 } from 'lucide-react';

export default function SupplyPointModal({ supplyPoint, onClose }: { supplyPoint: any, onClose: () => void }) {
  if (!supplyPoint) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-2xl w-full max-w-3xl shadow-2xl relative max-h-[90vh] flex flex-col">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Zap className="text-indigo-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Punto de Suministro
              </h2>
              <p className="text-sm text-slate-400 font-mono mt-0.5">{supplyPoint.cups}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Ubicación */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin size={16} /> Ubicación
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">Dirección Completa</p>
                <p className="text-sm text-white font-medium">{supplyPoint.address}</p>
                {!supplyPoint.address?.includes(supplyPoint.postalCode || '') && (
                  <p className="text-sm text-slate-300">{supplyPoint.city}, {supplyPoint.province} {supplyPoint.postalCode}</p>
                )}
              </div>
              
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">CNAE / Tarifa / Consumo</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-xs text-slate-500 block">CNAE</span>
                    <span className="text-sm text-white">{supplyPoint.cnae || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Tarifa Acceso</span>
                    <span className="text-sm text-white">{supplyPoint.tariff || '-'}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-xs text-slate-500 block">Consumo Anual</span>
                    <span className="text-sm text-white">{supplyPoint.annualConsumption ? `${supplyPoint.annualConsumption} MWh` : '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Potencias */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart2 size={16} /> Potencias (kW)
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[1,2,3,4,5,6].map(p => (
                <div key={p} className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">P{p}</p>
                  <p className="text-lg font-bold text-indigo-400">{supplyPoint[`p${p}c`] ?? '-'}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Autoconsumo & SIPS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Zap size={16} /> Autoconsumo
              </h3>
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                  <span className="text-sm text-slate-400">¿Tiene autoconsumo?</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${supplyPoint.hasSelfConsumption ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                    {supplyPoint.hasSelfConsumption ? 'SÍ' : 'NO'}
                  </span>
                </div>
                {supplyPoint.hasSelfConsumption && (
                  <>
                    <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                      <span className="text-sm text-slate-400">Tipo Autoconsumo</span>
                      <span className="text-sm text-white">{supplyPoint.selfConsumptionType || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                      <span className="text-sm text-slate-400">Tecnología G.</span>
                      <span className="text-sm text-white">{supplyPoint.generatorTechnology || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Potencia Instalada</span>
                      <span className="text-sm text-white">{supplyPoint.installedPowerGen ? `${supplyPoint.installedPowerGen} kW` : '-'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building size={16} /> Referencia Catastral
              </h3>
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <p className="text-sm text-white font-mono break-all">{supplyPoint.cadastralReference || 'No disponible'}</p>
              </div>
            </div>
          </section>

        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-700/50 bg-slate-800/30 shrink-0 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
