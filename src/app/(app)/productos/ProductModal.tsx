'use client';

import { useState } from 'react';
import { X, Save, AlertCircle, Trash2, Globe } from 'lucide-react';
import { useSession } from 'next-auth/react';

function ModalInputField({
  label,
  value,
  onChange,
  type = 'text',
  step,
}: {
  label: string;
  value: any;
  onChange: (val: any) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        step={step}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const TARIFF_LIST = ['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD'];

export default function ProductModal({ product, onClose, onSaved }: any) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'COMERCIAL';
  const canEdit = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);
  const isExisting = Boolean(product?.id);

  const [formData, setFormData] = useState({
    name: product?.name || '',
    type: product?.type || (product?.pricingModel === 'INDEXED' ? 'Indexado' : 'Fijo'),
    tariff: product?.tariff || '2.0TD',
    isAvailableCrm: product?.isAvailableCrm ?? true,
    isAvailableWeb: Boolean(product?.isAvailableWeb),
    permanenceMonths: product?.permanenceMonths ?? 12,
    isCustomizable: product?.isCustomizable || false,
    pricingModel: product?.pricingModel || 'FIXED',

    // Autoconsumo
    hasSelfConsumption: product?.hasSelfConsumption || false,
    selfConsumptionType: product?.selfConsumptionType || 'No aplica',
    pexc: product?.pexc ?? 0,
    feeExcedentes: product?.feeExcedentes ?? 0,
    cgBolsilloSolar: product?.cgBolsilloSolar ?? 0,

    // Indexado / Comisiones
    fee: product?.fee ?? 0,
    deviationCost: product?.deviationCost ?? 0,
    commissionType: product?.commissionType || 'MARGIN_PERCENTAGE',

    // Fijos Potencia
    p1p: product?.p1p ?? 0,
    p2p: product?.p2p ?? 0,
    p3p: product?.p3p ?? 0,
    p4p: product?.p4p ?? 0,
    p5p: product?.p5p ?? 0,
    p6p: product?.p6p ?? 0,

    // Fijos Energía
    p1e: product?.p1e ?? 0,
    p2e: product?.p2e ?? 0,
    p3e: product?.p3e ?? 0,
    p4e: product?.p4e ?? 0,
    p5e: product?.p5e ?? 0,
    p6e: product?.p6e ?? 0,

    // Márgenes Internos
    marginFC: product?.marginFC ?? 0,
    ip1: product?.ip1 ?? 0,
    ip2: product?.ip2 ?? 0,
    ip3: product?.ip3 ?? 0,
    ip4: product?.ip4 ?? 0,
    ip5: product?.ip5 ?? 0,
    ip6: product?.ip6 ?? 0,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  const setField = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!String(formData.name || '').trim()) {
        throw new Error('El nombre del producto es obligatorio.');
      }

      const url = isExisting ? `/api/products/${product.id}` : '/api/products';
      const method = isExisting ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const respJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(respJson.error || 'Error al guardar el producto');
      }

      onSaved(respJson);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isExisting || !canEdit) return;
    if (!confirm(`¿Seguro que deseas eliminar el producto "${product.name}"?`)) return;

    try {
      setDeleting(true);
      setError('');
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      const respJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(respJson.error || 'No se pudo eliminar el producto');
      }
      onSaved({ deletedId: product.id });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-bottom-4 zoom-in-95 max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/30">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              {!canEdit ? 'Ficha de Producto' : isExisting ? 'Editar Producto' : 'Nuevo Producto'}
              {!formData.isAvailableCrm && <span className="badge badge-draft ml-2">Oculto en CRM</span>}
              {formData.isAvailableWeb && (
                <span
                  className="badge badge-draft ml-1 inline-flex items-center gap-1"
                  style={{
                    color: '#38bdf8',
                    borderColor: 'rgba(56, 189, 248, 0.45)',
                    background: 'rgba(56, 189, 248, 0.12)',
                  }}
                >
                  <Globe size={12} />
                  Visible en Web
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Configuración técnica, esquema de precios y márgenes</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-800 px-6 gap-6 overflow-x-auto no-scrollbar">
          {['general', 'potencia', 'energia', 'autoconsumo', ...(canEdit ? ['comisiones', 'márgenes'] : [])].map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            )
          )}
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1">
          <fieldset disabled={!canEdit} className="contents">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 text-sm mb-6">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <ModalInputField
                    label="Nombre del Producto"
                    value={formData.name}
                    onChange={(v) => setField('name', v)}
                  />

                  <ModalInputField
                    label="Descripción del Tipo (ej. Precio fijo único)"
                    value={formData.type}
                    onChange={(v) => setField('type', v)}
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Modelo de Precio (Motor)</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      value={formData.pricingModel}
                      onChange={(e) => setField('pricingModel', e.target.value)}
                    >
                      <option value="FIXED">Fijo</option>
                      <option value="INDEXED">Indexado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Tarifa de Acceso</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      value={formData.tariff}
                      onChange={(e) => setField('tariff', e.target.value)}
                    >
                      <option value="">Sin Tarifa</option>
                      {TARIFF_LIST.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <ModalInputField
                    label="Permanencia (Meses)"
                    type="number"
                    value={formData.permanenceMonths}
                    onChange={(v) => setField('permanenceMonths', v)}
                  />
                </div>

                <div className="flex flex-wrap gap-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500"
                      checked={formData.isAvailableCrm}
                      onChange={(e) => setField('isAvailableCrm', e.target.checked)}
                    />
                    <span className="text-sm text-slate-200">Disponible en CRM (Visible para contratación)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-sky-500"
                      checked={formData.isAvailableWeb}
                      onChange={(e) => setField('isAvailableWeb', e.target.checked)}
                    />
                    <span className="text-sm text-slate-200 inline-flex items-center gap-1.5">
                      <Globe size={15} className="text-sky-400" />
                      Visible en Web Pública
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500"
                      checked={formData.isCustomizable}
                      onChange={(e) => setField('isCustomizable', e.target.checked)}
                    />
                    <span className="text-sm text-slate-200">¿Es Personalizable por Canal? (Fee / IP editables)</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'potencia' && (
              <div className="grid grid-cols-3 gap-6">
                <ModalInputField label="P1P (€/kW/año)" type="number" step="0.000001" value={formData.p1p} onChange={(v) => setField('p1p', v)} />
                <ModalInputField label="P2P (€/kW/año)" type="number" step="0.000001" value={formData.p2p} onChange={(v) => setField('p2p', v)} />
                {formData.tariff !== '2.0TD' && (
                  <>
                    <ModalInputField label="P3P (€/kW/año)" type="number" step="0.000001" value={formData.p3p} onChange={(v) => setField('p3p', v)} />
                    <ModalInputField label="P4P (€/kW/año)" type="number" step="0.000001" value={formData.p4p} onChange={(v) => setField('p4p', v)} />
                    <ModalInputField label="P5P (€/kW/año)" type="number" step="0.000001" value={formData.p5p} onChange={(v) => setField('p5p', v)} />
                    <ModalInputField label="P6P (€/kW/año)" type="number" step="0.000001" value={formData.p6p} onChange={(v) => setField('p6p', v)} />
                  </>
                )}
              </div>
            )}

            {activeTab === 'energia' && (
              <div className="grid grid-cols-3 gap-6">
                <ModalInputField label="P1E (€/kWh)" type="number" step="0.000001" value={formData.p1e} onChange={(v) => setField('p1e', v)} />
                <ModalInputField label="P2E (€/kWh)" type="number" step="0.000001" value={formData.p2e} onChange={(v) => setField('p2e', v)} />
                <ModalInputField label="P3E (€/kWh)" type="number" step="0.000001" value={formData.p3e} onChange={(v) => setField('p3e', v)} />
                {formData.tariff !== '2.0TD' && (
                  <>
                    <ModalInputField label="P4E (€/kWh)" type="number" step="0.000001" value={formData.p4e} onChange={(v) => setField('p4e', v)} />
                    <ModalInputField label="P5E (€/kWh)" type="number" step="0.000001" value={formData.p5e} onChange={(v) => setField('p5e', v)} />
                    <ModalInputField label="P6E (€/kWh)" type="number" step="0.000001" value={formData.p6e} onChange={(v) => setField('p6e', v)} />
                  </>
                )}
              </div>
            )}

            {activeTab === 'autoconsumo' && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500"
                    checked={formData.hasSelfConsumption}
                    onChange={(e) => setField('hasSelfConsumption', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-white">¿Aplica Autoconsumo?</span>
                </label>

                {formData.hasSelfConsumption && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-top-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Modalidad Autoconsumo</label>
                      <select
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        value={formData.selfConsumptionType}
                        onChange={(e) => setField('selfConsumptionType', e.target.value)}
                      >
                        <option value="No aplica">No aplica</option>
                        <option value="Con excedentes">Con excedentes</option>
                        <option value="Precio fijo">Precio Fijo</option>
                      </select>
                    </div>
                    <ModalInputField label="PExc - Precio Excedentes (€/MWh)" type="number" step="0.01" value={formData.pexc} onChange={(v) => setField('pexc', v)} />
                    <ModalInputField label="Fee Excedentes (€/MWh)" type="number" step="0.01" value={formData.feeExcedentes} onChange={(v) => setField('feeExcedentes', v)} />
                    <ModalInputField label="CG Bolsillo Solar (€/mes)" type="number" step="0.01" value={formData.cgBolsilloSolar} onChange={(v) => setField('cgBolsilloSolar', v)} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'comisiones' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Comisión</label>
                    <select
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      value={formData.commissionType}
                      onChange={(e) => setField('commissionType', e.target.value)}
                    >
                      <option value="MARGIN_PERCENTAGE">% sobre Margen</option>
                      <option value="POWER_TIERS">Por Tramos (Potencia)</option>
                    </select>
                  </div>
                  <ModalInputField label="Fee Energía (€/MWh)" type="number" step="0.01" value={formData.fee} onChange={(v) => setField('fee', v)} />
                  <ModalInputField label="Coste Desvío (DSV) (€/MWh)" type="number" step="0.01" value={formData.deviationCost} onChange={(v) => setField('deviationCost', v)} />
                </div>
              </div>
            )}

            {activeTab === 'márgenes' && (
              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-4">Márgenes Base del Producto</h3>
                <p className="text-xs text-slate-400 mb-6">
                  Configura el margen comercial interno de este producto (confidencial). Se utiliza en el motor de comisiones para calcular reglas de % sobre margen.
                </p>

                <ModalInputField
                  label="Fee de Comercialización Energía (marginFC) (€/MWh)"
                  type="number"
                  step="0.01"
                  value={formData.marginFC}
                  onChange={(v) => setField('marginFC', v)}
                />

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-4">Márgenes de Potencia (IP) (€/kW/año)</h4>
                  <div className="grid grid-cols-3 gap-6">
                    <ModalInputField label="IP P1" type="number" step="0.01" value={formData.ip1} onChange={(v) => setField('ip1', v)} />
                    <ModalInputField label="IP P2" type="number" step="0.01" value={formData.ip2} onChange={(v) => setField('ip2', v)} />
                    {formData.tariff !== '2.0TD' && (
                      <>
                        <ModalInputField label="IP P3" type="number" step="0.01" value={formData.ip3} onChange={(v) => setField('ip3', v)} />
                        <ModalInputField label="IP P4" type="number" step="0.01" value={formData.ip4} onChange={(v) => setField('ip4', v)} />
                        <ModalInputField label="IP P5" type="number" step="0.01" value={formData.ip5} onChange={(v) => setField('ip5', v)} />
                        <ModalInputField label="IP P6" type="number" step="0.01" value={formData.ip6} onChange={(v) => setField('ip6', v)} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </fieldset>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex items-center justify-between gap-3">
          <div>
            {canEdit && isExisting && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              {canEdit ? 'Cancelar' : 'Cerrar'}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Guardando...' : 'Guardar Producto'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
