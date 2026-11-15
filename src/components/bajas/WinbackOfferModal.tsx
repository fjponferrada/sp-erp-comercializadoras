'use client';

import React, { useState } from 'react';
import {
  X,
  Send,
  Download,
  Loader2,
  Save,
  ExternalLink,
  FilePlus2,
  CheckCircle2,
} from 'lucide-react';
import type { BajaData } from '@/app/(app)/bajas/BajasClient';
import { saveWinbackTrackingAction } from '@/app/actions/bajasActions';

interface WinbackOfferModalProps {
  baja: BajaData | null;
  products: any[];
  onClose: () => void;
  onTrackingUpdated?: (
    contractId: string,
    tracking: {
      winbackStatus: string | null;
      winbackNotes: string | null;
      winbackLastContactAt: string | null;
      winbackProductOffered: string | null;
    }
  ) => void;
}

export const WINBACK_STATUS_OPTIONS = [
  { value: 'SIN_GESTION', label: 'Sin gestión' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'OFERTA_ENVIADA', label: 'Oferta enviada' },
  { value: 'EN_NEGOCIACION', label: 'En negociación' },
  { value: 'RECUPERADO', label: 'Recuperado (Ganado)' },
  { value: 'DESCARTADO', label: 'No interesado / Descartado' },
];

export default function WinbackOfferModal({
  baja,
  products,
  onClose,
  onTrackingUpdated,
}: WinbackOfferModalProps) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [destinationEmail, setDestinationEmail] = useState(
    baja?.email || baja?.invoiceEmail || ''
  );
  const [winbackStatus, setWinbackStatus] = useState(baja?.winbackStatus || 'SIN_GESTION');
  const [winbackNotes, setWinbackNotes] = useState(baja?.winbackNotes || '');
  const [loading, setLoading] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!baja) return null;

  const availableProductTypes = Array.from(new Set(products.map((p) => p.type).filter(Boolean)));

  const validProducts = products.filter((p) => {
    const rTarifaClean =
      baja.tarifa && baja.tarifa !== 'Sin tarifa'
        ? baja.tarifa.replace(/\s/g, '').toUpperCase()
        : '';
    const pTariffClean = p.tariff ? p.tariff.replace(/\s/g, '').toUpperCase() : '';

    if (rTarifaClean) {
      if (pTariffClean) {
        if (pTariffClean !== rTarifaClean) return false;
      } else if (!p.name.replace(/\s/g, '').toUpperCase().includes(rTarifaClean)) {
        return false;
      }
    }

    if (!baja.hasSelfConsumption && p.hasSelfConsumption) return false;

    if (
      productTypeFilter &&
      (!p.type || p.type.toLowerCase() !== productTypeFilter.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const formatRate = (val: any, decimals: number = 6): string => {
    if (val === null || val === undefined || val === '') return '0';
    const n = Number(val);
    if (isNaN(n) || n === 0) return '0';
    return parseFloat(n.toFixed(decimals)).toString();
  };

  const handleSaveTrackingOnly = async () => {
    setSavingTracking(true);
    setError('');
    setSuccessMsg('');
    try {
      const productObj = products.find((p) => p.id === selectedProduct);
      const res = await saveWinbackTrackingAction(baja.id, {
        winbackStatus,
        winbackNotes,
        ...(productObj ? { winbackProductOffered: productObj.name } : {}),
      });
      if (!res.success) {
        throw new Error(res.error || 'No se pudo guardar el seguimiento');
      }
      if (res.tracking && onTrackingUpdated) {
        onTrackingUpdated(baja.id, res.tracking);
      }
      setSuccessMsg('Seguimiento comercial guardado correctamente.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingTracking(false);
    }
  };

  const generatePDF = async (action: 'download' | 'send') => {
    if (!selectedProduct) {
      setError('Debes seleccionar un producto para generar la oferta.');
      return;
    }
    const cleanEmail = destinationEmail.trim();
    if (action === 'send' && !cleanEmail) {
      setError('Introduce un email de destino válido para enviar la oferta.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const productData = products.find((p) => p.id === selectedProduct);
      const isIndexed =
        productData?.pricingModel === 'INDEXED' ||
        String(productData?.type || '')
          .toLowerCase()
          .includes('index');

      const hasBolsillo =
        Boolean(productData?.cgBolsilloSolar && Number(productData.cgBolsilloSolar) > 0) ||
        String(productData?.selfConsumptionType || '')
          .toLowerCase()
          .includes('bolsillo') ||
        String(productData?.name || '')
          .toLowerCase()
          .includes('bolsillo');

      const leadPayload = {
        id: baja.id || baja.cups,
        businessName: baja.cliente,
        vatNumber: baja.vatNumber || '',
        email: cleanEmail,
        phone: baja.telefono || '',
        address: baja.address || '',
        cups: baja.cups,
        tariff: baja.tarifa !== 'Sin tarifa' ? baja.tarifa : '2.0TD',
        estimatedMWh: baja.mwh,
        p1c: baja.p1c,
        p2c: baja.p2c,
        p3c: baja.p3c,
        p4c: baja.p4c,
        p5c: baja.p5c,
        p6c: baja.p6c,
        productName: productData?.name || '',
        productType: productData?.type || '',
        brandId: baja.brandId || undefined,
        brandName: baja.brandName,
        brandCode: baja.brandCode,
        brandEmail: baja.brandEmail,
        brandPhone: baja.brandPhone,
        brandDomain: baja.brandDomain,
        brandAddress: baja.brandAddress,
      };

      const pricesPayload = {
        isIndexed,
        // Energy prices (€/kWh) mapped from p1e..p6e
        p1: formatRate(productData?.p1e),
        p2: formatRate(productData?.p2e),
        p3: formatRate(productData?.p3e),
        p4: formatRate(productData?.p4e),
        p5: formatRate(productData?.p5e),
        p6: formatRate(productData?.p6e),
        // Power prices (€/kW/día) mapped from p1p..p6p
        p1p: formatRate(productData?.p1p),
        p2p: formatRate(productData?.p2p),
        p3p: formatRate(productData?.p3p),
        p4p: formatRate(productData?.p4p),
        p5p: formatRate(productData?.p5p),
        p6p: formatRate(productData?.p6p),
        // Self-consumption & Indexed parameters
        pexc: formatRate(productData?.pexc),
        fee: productData?.fee != null ? Number(productData.fee).toFixed(2) : '0.00',
        feeExcedentes:
          productData?.feeExcedentes != null
            ? Number(productData.feeExcedentes).toFixed(2)
            : '0.00',
        bolsilloSolar: hasBolsillo,
        cgBolsilloSolar:
          productData?.cgBolsilloSolar != null
            ? formatRate(productData.cgBolsilloSolar, 4)
            : undefined,
      };

      const offerType =
        productData?.type === 'Autoconsumo' ||
        productData?.hasSelfConsumption ||
        baja.hasSelfConsumption
          ? 'autoconsumo'
          : 'suministro';

      const res = await fetch('/api/pdf/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: leadPayload,
          prices: pricesPayload,
          offerType,
          action,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || 'Error al procesar el PDF de oferta');
      }

      if (action === 'download') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Oferta_Recuperacion_${baja.cups}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Error al enviar email');
        }
      }

      const nextStatus = winbackStatus === 'RECUPERADO' ? 'RECUPERADO' : 'OFERTA_ENVIADA';
      setWinbackStatus(nextStatus);

      const trackRes = await saveWinbackTrackingAction(baja.id, {
        winbackStatus: nextStatus,
        winbackNotes,
        winbackProductOffered: productData?.name || null,
      });

      if (trackRes.success && trackRes.tracking && onTrackingUpdated) {
        onTrackingUpdated(baja.id, trackRes.tracking);
      }

      if (action === 'send') {
        alert(`Oferta enviada por email a ${cleanEmail} correctamente.`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProductObj = products.find((p) => p.id === selectedProduct);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden animate-zoom-in">
        <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Gestión de Recuperación (Winback)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              CUPS: {baja.cups} · {baja.vatNumber || 'Sin NIF'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Datos Suministro + Accesos Directos a Leads */}
          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-indigo-500/10">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Datos del Suministro
              </h3>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/leads?action=offer&cups=${encodeURIComponent(baja.cups)}`}
                  className="text-xs px-2.5 py-1 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 inline-flex items-center gap-1 transition-colors"
                  title="Abrir cotizador completo en Leads con Auto-SIPS"
                >
                  <ExternalLink size={12} /> Oferta en Leads
                </a>
                <a
                  href={`/leads?action=contract&cups=${encodeURIComponent(baja.cups)}`}
                  className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 inline-flex items-center gap-1 transition-colors"
                  title="Iniciar Alta de Luz limpia con Auto-SIPS (solicitará nuevo IBAN y factura)"
                >
                  <FilePlus2 size={12} /> Pasar a Alta Luz
                </a>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-300">
              <p>
                <strong>Titular:</strong> {baja.cliente}
              </p>
              <p>
                <strong>Tarifa:</strong> {baja.tarifa}{' '}
                {baja.hasSelfConsumption && (
                  <span className="text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-1">
                    SOLAR
                  </span>
                )}
              </p>
              <p>
                <strong>Consumo Anual:</strong> {baja.mwh} MWh/año
              </p>
              <p>
                <strong>Producto Anterior:</strong> {baja.producto}
              </p>
              {baja.address && (
                <p className="sm:col-span-2 text-gray-400 truncate" title={baja.address}>
                  <strong>Dirección:</strong> {baja.address}
                </p>
              )}
            </div>
          </div>

          {/* Bloque CRM Seguimiento */}
          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Seguimiento Comercial CRM
              </h3>
              {baja.winbackLastContactAt && (
                <span className="text-[11px] text-gray-400">
                  Últ. gestión: {new Date(baja.winbackLastContactAt).toLocaleDateString('es-ES')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Estado de Recuperación
                </label>
                <select
                  className="form-input w-full text-sm"
                  value={winbackStatus}
                  onChange={(e) => setWinbackStatus(e.target.value)}
                  disabled={loading || savingTracking}
                >
                  {WINBACK_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSaveTrackingOnly}
                  disabled={loading || savingTracking}
                  className="btn-secondary w-full flex items-center justify-center gap-1.5 text-xs py-2"
                >
                  {savingTracking ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Guardar Estado / Notas
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Notas de contacto / Motivo real cliente
              </label>
              <textarea
                rows={2}
                className="form-input w-full text-xs"
                placeholder="Ej: Llamado hoy, competidor le ofreció 0,12 €/kWh fijo, enviamos contraoferta..."
                value={winbackNotes}
                onChange={(e) => setWinbackNotes(e.target.value)}
                disabled={loading || savingTracking}
              />
            </div>
          </div>

          {/* Generador Rápido de Oferta PDF */}
          <div className="space-y-3 pt-1">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Generar Propuesta Económica PDF
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Filtrar Tipo Producto
                </label>
                <select
                  className="form-input w-full text-sm"
                  value={productTypeFilter}
                  onChange={(e) => {
                    setProductTypeFilter(e.target.value);
                    setSelectedProduct('');
                  }}
                  disabled={loading}
                >
                  <option value="">Todos los tipos</option>
                  {availableProductTypes.map((type: any) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Email destinatario cliente
                </label>
                <input
                  type="email"
                  className="form-input w-full text-sm"
                  placeholder="cliente@ejemplo.com"
                  value={destinationEmail}
                  onChange={(e) => setDestinationEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Producto a ofertar ({validProducts.length} compatibles)
              </label>
              <select
                className="form-input w-full text-sm"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecciona un producto...</option>
                {validProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.type || 'General'}
                  </option>
                ))}
              </select>
            </div>

            {selectedProductObj && (
              <div className="p-2.5 rounded-lg bg-white/5 border border-[var(--border)] text-xs text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
                {selectedProductObj.pricingModel === 'INDEXED' ? (
                  <span>
                    <strong>Modalidad:</strong> Indexado (Fee:{' '}
                    {Number(selectedProductObj.fee || 0).toFixed(2)} €)
                  </span>
                ) : (
                  <span>
                    <strong>Energía (€/kWh):</strong> P1 {formatRate(selectedProductObj.p1e, 4)} ·
                    P2 {formatRate(selectedProductObj.p2e, 4)} · P3{' '}
                    {formatRate(selectedProductObj.p3e, 4)}
                  </span>
                )}
                <span>
                  <strong>Potencia (€/kW/d):</strong> P1 {formatRate(selectedProductObj.p1p, 4)} ·
                  P2 {formatRate(selectedProductObj.p2p, 4)}
                </span>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
          {successMsg && (
            <p className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 size={14} /> {successMsg}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-elevated)] flex flex-wrap gap-2.5 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm" disabled={loading}>
            Cerrar
          </button>
          <button
            onClick={() => generatePDF('download')}
            className="btn-secondary flex items-center gap-1.5 text-sm"
            disabled={loading || !selectedProduct}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Descargar PDF
          </button>
          <button
            onClick={() => generatePDF('send')}
            className="btn-primary flex items-center gap-1.5 text-sm"
            disabled={loading || !selectedProduct}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar Oferta por Email
          </button>
        </div>
      </div>
    </div>
  );
}
