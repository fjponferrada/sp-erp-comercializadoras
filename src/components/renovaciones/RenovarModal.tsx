'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { renewContractAction, comunicarRenovacionTacitaAction } from '@/app/actions/renovacionesActions';
import { useRouter } from 'next/navigation';

export default function RenovarModal({
  isOpen,
  onClose,
  renovaciones,
  products,
  additionalServices,
  onRenovado,
  userRole
}: {
  isOpen: boolean;
  onClose: () => void;
  renovaciones: any[];
  products: any[];
  additionalServices: any[];
  onRenovado: (contractId: string) => void;
  userRole?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [renovacionType, setRenovacionType] = useState<'EXPRESA' | 'TACITA'>('EXPRESA');
  const [comunicarMasivamente, setComunicarMasivamente] = useState(false);
  const [formData, setFormData] = useState<{ productId: string, servicioAdicional: string, additionalServiceIds: string[] }>({
    productId: '',
    servicioAdicional: '',
    additionalServiceIds: renovaciones?.length === 1 ? (renovaciones[0].additionalServiceIds || []) : []
  });
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const router = useRouter();

  React.useEffect(() => {
    if (isOpen && renovaciones && renovaciones.length > 0) {
      setFormData(prev => ({
        ...prev,
        additionalServiceIds: renovaciones.length === 1 ? (renovaciones[0].additionalServiceIds || []) : []
      }));
    }
  }, [isOpen, renovaciones]);

  if (!isOpen || !renovaciones || renovaciones.length === 0) return null;
  console.log('PRODUCTS:', products.map(p => ({id: p.id, type: p.type, feeExcedentes: p.feeExcedentes, pexc: p.pexc})));
  console.log('RENOVACIONES MASIVAS:', renovaciones.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId) {
      alert('Debes seleccionar un Producto');
      return;
    }

    setLoading(true);
    const successIds: string[] = [];
    for (const r of renovaciones) {
      const res = await renewContractAction(r.contractId, formData.productId, false, formData.servicioAdicional, formData.additionalServiceIds, renovacionType);
      if (res.error) {
        alert(`Error en contrato ${r.contractId}: ${res.error}`);
      } else if (res.contractId) {
        onRenovado(r.contractId);
        successIds.push(res.contractId);

        if (renovacionType === 'TACITA' && comunicarMasivamente) {
          const comRes = await comunicarRenovacionTacitaAction(res.contractId);
          if (comRes?.error) {
            console.error(`Error comunicando renovación al contrato ${r.contractId}:`, comRes.error);
          }
        }
      }
    }
    setLoading(false);

    if (successIds.length > 0) {
      onClose();
      if (successIds.length === 1) {
        router.push(`/contratos/${successIds[0]}`);
      } else {
        alert(`Renovados ${successIds.length} contratos correctamente.`);
      }
    }
  };

  // Filtrar tipos de producto disponibles para el desplegable (únicos)
  const availableProductTypes = Array.from(new Set(products.map(p => p.type).filter(Boolean)));

  const filteredProducts = products.filter(p => {
    // Todos los contratos seleccionados deben ser compatibles con el producto
    for (const r of renovaciones) {
      const rTarifaClean = r.tarifa ? r.tarifa.replace(/\s/g, '').toUpperCase() : '';
      const pTariffClean = p.tariff ? p.tariff.replace(/\s/g, '').toUpperCase() : '';
      
      if (pTariffClean) {
        if (pTariffClean !== rTarifaClean) return false;
      } else {
        if (rTarifaClean && !p.name.replace(/\s/g, '').toUpperCase().includes(rTarifaClean)) return false;
      }
      
      if (!r.hasSelfConsumption && p.hasSelfConsumption) return false;
    }

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
            {renovaciones.length === 1 ? (
              <p className="text-sm text-slate-300">Suministro: <strong className="text-white">{renovaciones[0].tarifa}</strong> {renovaciones[0].hasSelfConsumption && <span className="text-amber-400 text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-2">AUTOCONSUMO</span>}</p>
            ) : (
              <p className="text-sm text-slate-300"><strong className="text-white">{renovaciones.length}</strong> contratos seleccionados para renovación.</p>
            )}
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

          {['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole || '') && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">Tipo de Renovación</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="renovacionType"
                    value="EXPRESA"
                    checked={renovacionType === 'EXPRESA'}
                    onChange={() => setRenovacionType('EXPRESA')}
                    className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500 focus:ring-2"
                  />
                  <span className="text-white text-sm">Expresa (DocuSign)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="renovacionType"
                    value="TACITA"
                    checked={renovacionType === 'TACITA'}
                    onChange={() => setRenovacionType('TACITA')}
                    className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500 focus:ring-2"
                  />
                  <span className="text-white text-sm">Tácita (Automática)</span>
                </label>
              </div>
              {renovacionType === 'TACITA' && (
                <div className="mt-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                  <p className="text-xs text-amber-400 mb-3 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    Se generará una nueva versión del contrato actual en estado ACEPTADO. El cron automático activará esta versión y finalizará la anterior en la fecha de vencimiento sin necesidad de firma. No se generará PDF de DocuSign.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer mt-2 border-t border-slate-700/50 pt-3">
                    <input
                      type="checkbox"
                      checked={comunicarMasivamente}
                      onChange={(e) => setComunicarMasivamente(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">Comunicar Renovación Tácita ahora</span>
                      <span className="text-xs text-slate-400">Se enviará el email resumen a todos los clientes seleccionados automáticamente.</span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wide">Servicios Adicionales</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {additionalServices.map((svc: any) => (
                <label key={svc.id} className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer hover:border-amber-500/50 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                    checked={formData.additionalServiceIds.includes(svc.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, additionalServiceIds: [...prev.additionalServiceIds, svc.id] }));
                      } else {
                        setFormData(prev => ({ ...prev, additionalServiceIds: prev.additionalServiceIds.filter(id => id !== svc.id) }));
                      }
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">{svc.name}</span>
                    <span className="text-xs text-slate-500">{(svc.dailyPrice || 0).toLocaleString('es-ES', { minimumFractionDigits: 3 })} €/día</span>
                  </div>
                </label>
              ))}
            </div>
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
