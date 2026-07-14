'use client';

import React, { useState } from 'react';
import { createRenewalLead } from '@/app/actions/renewActions';
import { RefreshCw, X, Shield, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RenewContractModal({ contract, onClose }: { contract: any, onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'RENOVACION' | 'M1N' | 'M1S'>('RENOVACION');

  // M1N Fields
  const [tariff, setTariff] = useState(contract.supplyPoint?.tariff || '');
  
  // M1S Fields
  const [businessName, setBusinessName] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data: any = {
      contractId: contract.id,
      type
    };

    if (type === 'M1N') {
      data.tariff = tariff;
    }

    if (type === 'M1S') {
      data.clientData = { businessName, vatNumber };
    }

    const result = await createRenewalLead(data);
    
    setLoading(false);
    if (result.success) {
      alert('Se ha creado el Lead de Renovación/Modificación. Redirigiendo...');
      // router.push(`/leads/${result.leadId}`);
      onClose();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="text-indigo-400" />
            Renovar o Modificar Contrato
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-sm text-indigo-200">
            Esta acción generará un nuevo <strong>Lead de Oportunidad</strong> pre-rellenado con los datos del contrato actual ({contract.id}).
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Trámite</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setType('RENOVACION')}
                className={`p-3 text-sm font-medium rounded-xl border transition-colors ${type === 'RENOVACION' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
              >
                Renovación Pura
              </button>
              <button
                type="button"
                onClick={() => setType('M1N')}
                className={`p-3 text-sm font-medium rounded-xl border transition-colors ${type === 'M1N' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
              >
                Cambio Técnico (M1N)
              </button>
              <button
                type="button"
                onClick={() => setType('M1S')}
                className={`p-3 text-sm font-medium rounded-xl border transition-colors ${type === 'M1S' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
              >
                Subrogación (M1S)
              </button>
            </div>
          </div>

          {type === 'M1N' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-md font-semibold text-white border-b border-slate-700 pb-2">Datos del Cambio Técnico</h3>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nueva Tarifa</label>
                <select 
                  value={tariff}
                  onChange={(e) => setTariff(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
                >
                  <option value="2.0TD">2.0TD</option>
                  <option value="3.0TD">3.0TD</option>
                  <option value="6.1TD">6.1TD</option>
                </select>
              </div>
            </div>
          )}

          {type === 'M1S' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-md font-semibold text-white border-b border-slate-700 pb-2">Datos del Nuevo Titular</h3>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Razón Social / Nombre</label>
                <input 
                  type="text" 
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Nuevo titular"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">NIF / CIF</label>
                <input 
                  type="text" 
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="B12345678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-700 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generando Lead...' : 'Crear Trámite'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
