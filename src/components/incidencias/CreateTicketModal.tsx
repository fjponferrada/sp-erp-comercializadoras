'use client';

import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  codigoMarca?: string | null;
}

interface SupplyPoint {
  id: string;
  cups: string;
  address: string;
}

export default function CreateTicketModal({
  isOpen,
  onClose,
  brands,
  onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brandId: brands[0]?.id || '',
    nif: '',
    supplyPointId: '',
    motivo: '',
    consulta: '',
    nivel: 'Nivel 1 - Comercializadora'
  });

  const [cupsList, setCupsList] = useState<SupplyPoint[]>([]);
  const [searchingNif, setSearchingNif] = useState(false);

  const handleSearchNif = async () => {
    if (!formData.nif) return;
    setSearchingNif(true);
    try {
      const res = await fetch(`/api/clients/search?nif=${formData.nif}`);
      const data = await res.json();
      if (data.found && data.cups) {
        setCupsList(data.cups);
        if (data.cups.length > 0) {
          setFormData(prev => ({ ...prev, supplyPointId: data.cups[0].id }));
        }
      } else {
        setCupsList([]);
        alert('No se encontraron instalaciones para este NIF.');
      }
    } catch (e) {
      console.error(e);
      alert('Error buscando NIF');
    }
    setSearchingNif(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onCreated();
        onClose();
        setFormData({
          brandId: brands[0]?.id || '',
          nif: '',
          supplyPointId: '',
          motivo: '',
          consulta: '',
          nivel: 'Nivel 1 - Comercializadora'
        });
        setCupsList([]);
      } else {
        alert('Error al crear ticket');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const motivos = [
    "Reclamación de factura",
    "Modificación de contador",
    "Modificación de potencias y/o tarifa",
    "Modificación de titular",
    "Modificación de cuenta corriente",
    "Activación Autoconsumo",
    "F1 disponible",
    "Baja de contrato",
    "Otros motivos"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl relative my-8">
        
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-sky-700/20 rounded-t-3xl">
          <h2 className="text-xl font-bold text-white">Crear un nuevo ticket</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Marca</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              value={formData.brandId}
              onChange={e => setFormData({ ...formData, brandId: e.target.value })}
              required
            >
              <option value="">Seleccione marca...</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.codigoMarca ? `${b.codigoMarca} - ` : ''}{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">NIF Cliente</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                value={formData.nif}
                onChange={e => setFormData({ ...formData, nif: e.target.value })}
                placeholder="Introduzca NIF"
              />
              <button 
                type="button" 
                onClick={handleSearchNif}
                disabled={searchingNif || !formData.nif}
                className="bg-sky-500 hover:bg-sky-600 text-white p-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <Search size={18} />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">CUPS</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              value={formData.supplyPointId}
              onChange={e => setFormData({ ...formData, supplyPointId: e.target.value })}
              disabled={cupsList.length === 0}
            >
              <option value="">Seleccione un cups</option>
              {cupsList.map(c => (
                <option key={c.id} value={c.id}>{c.cups} - {c.address}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Motivo</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              value={formData.motivo}
              onChange={e => setFormData({ ...formData, motivo: e.target.value })}
              required
            >
              <option value="">Seleccione un motivo</option>
              {motivos.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Detalle la consulta</label>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
              rows={4}
              value={formData.consulta}
              onChange={e => setFormData({ ...formData, consulta: e.target.value })}
              placeholder="Por favor, detalle la consulta"
              required
            />
          </div>

          <div>
            <span className="text-xs text-red-400 mb-1 block">Pulsando la tecla ctrl podrá seleccionar mas de 1 archivo.</span>
            <input 
              type="file" 
              multiple 
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              Descartar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              {loading ? 'Creando...' : '+ Crear Consulta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
