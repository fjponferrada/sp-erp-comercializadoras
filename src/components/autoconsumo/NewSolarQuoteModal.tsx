'use client';

import React, { useState } from 'react';
import { createSolarQuoteAction } from '@/app/actions/solarActions';
import { Plus, X, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NewSolarQuoteModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    clientName: '',
    clientLastName: '',
    clientEmail: '',
    clientPhone: '',
    cups: '',
    address: '',
    city: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await createSolarQuoteAction(formData);
    
    setLoading(false);
    if (res.success) {
      setIsOpen(false);
      router.push(`/autoconsumo/${res.quote?.id || ''}`);
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20"
      >
        <Plus size={20} />
        Nuevo Estudio Solar
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sun className="text-amber-400" /> Nuevo Proyecto Fotovoltaico
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nombre</label>
                  <input required type="text" name="clientName" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Apellidos</label>
                  <input type="text" name="clientLastName" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
                  <input type="text" name="clientPhone" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input type="email" name="clientEmail" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">CUPS (Opcional en esta fase)</label>
                <input type="text" name="cups" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono uppercase outline-none focus:border-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Dirección de Instalación</label>
                  <input type="text" name="address" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Localidad</label>
                  <input type="text" name="city" onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="px-6 py-2.5 text-slate-300 hover:text-white">Cancelar</button>
                <button type="submit" disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
                  {loading ? 'Creando...' : 'Crear Expediente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
