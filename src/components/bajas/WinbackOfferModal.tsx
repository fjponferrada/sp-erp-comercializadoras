import React, { useState } from 'react';
import { X, Send, Download, FileText, Loader2, Phone, Mail } from 'lucide-react';
import { BajaData } from '@/app/(app)/bajas/BajasClient';

interface WinbackOfferModalProps {
  baja: BajaData | null;
  products: any[];
  onClose: () => void;
}

export default function WinbackOfferModal({ baja, products, onClose }: WinbackOfferModalProps) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!baja) return null;

  const availableProductTypes = Array.from(new Set(products.map(p => p.type).filter(Boolean)));

  const validProducts = products.filter(p => {
    const rTarifaClean = baja.tarifa ? baja.tarifa.replace(/\s/g, '').toUpperCase() : '';
    const pTariffClean = p.tariff ? p.tariff.replace(/\s/g, '').toUpperCase() : '';
    
    if (pTariffClean) {
      if (pTariffClean !== rTarifaClean) return false;
    } else {
      if (rTarifaClean && !p.name.replace(/\s/g, '').toUpperCase().includes(rTarifaClean)) return false;
    }
    
    if (!baja.hasSelfConsumption && p.hasSelfConsumption) return false;

    if (productTypeFilter && (!p.type || p.type.toLowerCase() !== productTypeFilter.toLowerCase())) return false;

    return true;
  });

  const generatePDF = async (action: 'download' | 'send') => {
    if (!selectedProduct) {
      setError('Debes seleccionar un producto.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const productData = products.find(p => p.id === selectedProduct);
      
      const leadPayload = {
        id: baja.id || baja.cups,
        businessName: baja.cliente,
        vatNumber: '', // Not strictly needed, we pass what we have
        email: baja.email || '',
        phone: baja.telefono || '',
        address: baja.direccion || '',
        cups: baja.cups,
        tariff: baja.tarifa,
        estimatedMWh: baja.mwh
      };

      const pricesPayload = {
        p1: productData?.p1p || productData?.p1 || '0.000',
        p2: productData?.p2p || productData?.p2 || '0.000',
        p3: productData?.p3p || productData?.p3 || '0.000',
        p4: productData?.p4p || productData?.p4 || '0.000',
        p5: productData?.p5p || productData?.p5 || '0.000',
        p6: productData?.p6p || productData?.p6 || '0.000',
        fee: productData?.fee || productData?.feeIndex || '0.00',
        feeExcedentes: productData?.feeExcedentes || '0.00',
        bolsilloSolar: productData?.bolsilloSolar || false
      };

      const offerType = (productData?.type === 'Autoconsumo' || productData?.hasSelfConsumption || baja.hasSelfConsumption) ? 'autoconsumo' : 'suministro';

      const res = await fetch('/api/pdf/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: leadPayload,
          prices: pricesPayload,
          offerType,
          action
        }),
      });

      if (!res.ok) throw new Error('Error al procesar la oferta');
      
      if (action === 'download') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Oferta_Recuperacion_${baja.cliente}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        if (data.success) {
          alert(`Oferta enviada por email a ${baja.email || 'el cliente'} correctamente.`);
        } else {
          throw new Error(data.error || 'Error al enviar email');
        }
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden animate-zoom-in">
        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Generar Oferta de Recuperación</h2>
            <p className="text-sm text-gray-400 mt-1">CUPS: {baja.cups}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-indigo-500/10">
            <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-2">Datos Extraídos del Sistema</h3>
            <div className="space-y-1 text-sm text-gray-300">
              <p><strong>Cliente:</strong> {baja.cliente}</p>
              <p>
                <strong>Suministro:</strong> {baja.tarifa}
                {baja.hasSelfConsumption && <span className="text-amber-400 text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-2">AUTOCONSUMO</span>}
              </p>
              <p><strong>Consumo Anual:</strong> {baja.mwh} MWh</p>
            </div>
            <p className="text-xs text-indigo-300/70 mt-3 italic">
              No necesitas rellenar datos, usaremos el historial del cliente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Tipo de Producto (Opcional)
            </label>
            <select
              className="form-input w-full"
              value={productTypeFilter}
              onChange={e => {
                setProductTypeFilter(e.target.value);
                setSelectedProduct('');
              }}
              disabled={loading}
            >
              <option value="">Cualquier tipo</option>
              {availableProductTypes.map((type: any) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Producto a ofertar
            </label>
            <select 
              className="form-input w-full"
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecciona un producto...</option>
              {validProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} - {p.type || 'General'}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-elevated)] flex gap-3 justify-end">
          <button onClick={onClose} className="btn-ghost" disabled={loading}>
            Cancelar
          </button>
          <button 
            onClick={() => generatePDF('download')} 
            className="btn-secondary flex items-center gap-2"
            disabled={loading || !selectedProduct}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Descargar PDF
          </button>
          <button 
            onClick={() => generatePDF('send')} 
            className="btn-primary flex items-center gap-2"
            disabled={loading || !selectedProduct}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar Email
          </button>
        </div>
      </div>
    </div>
  );
}
