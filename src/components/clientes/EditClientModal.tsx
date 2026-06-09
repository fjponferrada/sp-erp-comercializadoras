'use client';

import React, { useState } from 'react';
import { updateClient } from '@/app/actions/clientActions';
import { X, Save } from 'lucide-react';

export default function EditClientModal({ client, onClose }: { client: any, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: client.businessName || '',
    vatNumber: client.vatNumber || '',
    contactEmail: client.contactEmail || '',
    contactPhone: client.contactPhone || '',
    billingAddress: client.billingAddress || '',
    iban: client.iban || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateClient(client.id, formData);
    
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
          <h2 className="text-xl font-bold text-white">Editar Datos del Cliente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Razón Social</label>
              <input 
                type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">CIF / NIF</label>
              <input 
                type="text" name="vatNumber" value={formData.vatNumber} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input 
                type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
              <input 
                type="text" name="contactPhone" value={formData.contactPhone} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Dirección de Facturación</label>
            <input 
              type="text" name="billingAddress" value={formData.billingAddress} onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-4">
            <label className="block text-sm font-semibold text-amber-500 mb-1">Cuenta Bancaria (IBAN)</label>
            <p className="text-xs text-amber-400/80 mb-2">Modificar este campo notificará automáticamente al dpto. financiero.</p>
            <input 
              type="text" name="iban" value={formData.iban} onChange={handleChange}
              placeholder="ES00 0000 0000 0000 0000"
              className="w-full bg-slate-900 border border-amber-500/30 rounded-lg px-4 py-2 text-white focus:border-amber-500 outline-none font-mono"
            />
          </div>

          <div className="pt-6 border-t border-slate-700 flex justify-end gap-3">
            <button 
              type="button" onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
