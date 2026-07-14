'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { renewContractAction } from '@/app/actions/renovacionesActions';
import { useRouter } from 'next/navigation';

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
    servicioAdicional: ''
  });
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const router = useRouter();

  if (!isOpen || !renovacion) return null;
  console.log('PRODUCTS:', products.map(p => ({id: p.id, type: p.type, feeExcedentes: p.feeExcedentes, pexc: p.pexc})));
  console.log('RENOVACION:', {tarifa: renovacion.tarifa, hasSelfConsumption: renovacion.hasSelfConsumption});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId) {
      alert('Debes seleccionar un Producto');
      return;
    }

    setLoading(true);
    const res = await renewContractAction(renovacion.contractId, formData.productId, false, formData.servicioAdicional);
    setLoading(false);

    if (res.error) {
      alert(res.error);
    } else if (res.contractId) {
      onRenovado(renovacion.contractId);
      onClose();
      router.push(`/contratos/${res.contractId}`);
    }
  };

  // Filtrar tipos de producto disponibles para el desplegable (únicos)
  const availableProductTypes = Array.from(new Set(products.map(p => p.type).filter(Boolean)));

  const filteredProducts = products.filter(p => {
    // 1. Filtrado obligatorio por tarifa de acceso
    // Si p.tariff es null, no debería colarse por defecto si esperamos que el producto sea específico de una tarifa.
    // Asumiremos que debe coincidir, o si es null, comprobamos si el nombre del producto incluye la tarifa.
    const rTarifaClean = renovacion.tarifa ? renovacion.tarifa.replace(/\s/g, '').toUpperCase() : '';
    const pTariffClean = p.tariff ? p.tariff.replace(/\s/g, '').toUpperCase() : '';
    
    if (pTariffClean) {
      if (pTariffClean !== rTarifaClean) return false;
    } else {
      // Si el producto no tiene tariff en la BD, intentamos adivinar por el nombre
      if (rTarifaClean && !p.name.replace(/\s/g, '').toUpperCase().includes(rTarifaClean)) return false;
    }
    
    // 2. Filtrado obligatorio por autoconsumo
    if (!renovacion.hasSelfConsumption && p.hasSelfConsumption) return false;

    // 3. Filtrado por tipo de producto exacto
    if (productTypeFilter && (!p.type || p.type.toLowerCase() !== productTypeFilter.toLowerCase())) return false;

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
              {availableProductTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
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

          {/* TODO: Pendiente de implementar
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
          */}

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
