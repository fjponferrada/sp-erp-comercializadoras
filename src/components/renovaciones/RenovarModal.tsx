'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function RenovarModal({
  isOpen,
  onClose,
  renovacion,
  products,
  onRenovado
}: {
  isOpen: boolean;
  onClose: () => void;
  renovacion: any;
  products: any[];
  onRenovado: (contractId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    servicioAdicional: '',
    firma: false
  });
  const [productTypeFilter, setProductTypeFilter] = useState('');

  if (!isOpen || !renovacion) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId) {
      alert('Debes seleccionar un Producto');
      return;
    }
    if (!formData.firma) {
      alert('Debes marcar la Firma Manuscrita');
      return;
    }

    setLoading(true);
    // Simular llamada a API para renovar
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoading(false);

    onRenovado(renovacion.contractId);
    onClose();
  };

  // Filtrado de productos basado en CUPS y filtro manual
  const filteredProducts = products.filter(p => {
    // 1. Filtrado obligatorio por tarifa de acceso
    if (p.type && p.type !== renovacion.tarifa) return false;
    
    // 2. Filtrado obligatorio por autoconsumo (si el suministro NO tiene, y el producto ES de excedentes -> false)
    // Asumiremos que si p.feeExcedentes o p.pexc está definido, es un producto para autoconsumo.
    // Esto es heurístico, idealmente el modelo Product tendría isForSelfConsumption.
    const isProductForSelfConsumption = (p.feeExcedentes !== null || p.pexc !== null);
    if (!renovacion.hasSelfConsumption && isProductForSelfConsumption) return false;

    // 3. Filtrado opcional por tipo de producto (Fijo, Indexado, etc)
    // No hay un campo exacto "productCategory" en Product, podríamos usar p.name o si tuviéramos un campo en BD.
    // Para el demo usaremos un string matching en el nombre si el comercial decide filtrar.
    if (productTypeFilter && !p.name.toLowerCase().includes(productTypeFilter.toLowerCase())) return false;

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Renovar Contrato</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700">
            <p className="text-sm text-slate-300">Suministro: <strong className="text-white">{renovacion.tarifa}</strong> {renovacion.hasSelfConsumption && <span className="text-amber-400 text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-2">AUTOCONSUMO</span>}</p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Tipo de Producto (Opcional)</label>
            <select
              value={productTypeFilter}
              onChange={e => {
                setProductTypeFilter(e.target.value);
                setFormData({ ...formData, productId: '' }); // reset producto si cambia tipo
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-amber-500 appearance-none"
            >
              <option value="">Cualquier tipo</option>
              <option value="fijo">Precio Fijo</option>
              <option value="indexado">Indexado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Producto Comercial *</label>
            <select
              required
              value={formData.productId}
              onChange={e => setFormData({ ...formData, productId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-amber-500 appearance-none"
            >
              <option value="">Selecciona producto...</option>
              {filteredProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {filteredProducts.length === 0 && <p className="text-xs text-red-400 mt-1">No hay productos disponibles para este tipo de CUPS.</p>}
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Servicio adicional</label>
            <select
              value={formData.servicioAdicional}
              onChange={e => setFormData({ ...formData, servicioAdicional: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-amber-500 appearance-none"
            >
              <option value="">Ninguno</option>
              <option value="Mantenimiento">Mantenimiento Básico</option>
              <option value="Urgencias">Cobertura de Urgencias</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Firma Manuscrita</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formData.firma}
                onChange={e => setFormData({ ...formData, firma: e.target.checked })}
                className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 bg-slate-900"
              />
              <span className="text-slate-300">Please check this box</span>
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-700">
            <button type="button" onClick={onClose} className="px-6 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-6 py-2 rounded-lg font-bold flex items-center justify-center transition-colors">
              {loading ? 'Procesando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
