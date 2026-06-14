import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

export default function ProductModal({ product, onClose, onSaved }: any) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    type: product?.type || 'FIX',
    tariff: product?.tariff || '',
    isAvailableCrm: product?.isAvailableCrm ?? true,
    permanenceMonths: product?.permanenceMonths || 12,
    gasIncluido: product?.gasIncluido || false,
    // General
    isCustomizable: product?.isCustomizable || false,
    pricingModel: product?.pricingModel || 'FIXED',
    
    // Autoconsumo
    hasSelfConsumption: product?.hasSelfConsumption || false,
    selfConsumptionType: product?.selfConsumptionType || 'No aplica',
    pexc: product?.pexc || 0,
    feeExcedentes: product?.feeExcedentes || 0,
    cgBolsilloSolar: product?.cgBolsilloSolar || 0,

    // Indexado / Comisiones
    fee: product?.fee || 0,
    deviationCost: product?.deviationCost || 0,
    commissionType: product?.commissionType || 'MARGIN_PERCENTAGE',

    // Fijos Potencia
    p1p: product?.p1p || 0,
    p2p: product?.p2p || 0,
    p3p: product?.p3p || 0,
    p4p: product?.p4p || 0,
    p5p: product?.p5p || 0,
    p6p: product?.p6p || 0,

    // Fijos Energía
    p1e: product?.p1e || 0,
    p2e: product?.p2e || 0,
    p3e: product?.p3e || 0,
    p4e: product?.p4e || 0,
    p5e: product?.p5e || 0,
    p6e: product?.p6e || 0,

  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      const isNew = !product?.id;
      const url = isNew ? '/api/products' : `/api/products/${product.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar el producto');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ label, field, type = 'text', step }: any) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        step={step}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        value={(formData as any)[field]}
        onChange={e => setFormData({ ...formData, [field]: type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value })}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-bottom-4 zoom-in-95 max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/30">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {product ? 'Editar Producto' : 'Nuevo Producto'}
              {!formData.isAvailableCrm && <span className="badge badge-draft ml-2">Oculto</span>}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Configuración técnica y esquema de precios</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-800 px-6 gap-6 overflow-x-auto no-scrollbar">
          {['general', 'potencia', 'energia', 'autoconsumo', 'comisiones'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 text-sm mb-6">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Nombre del Producto" field="name" />
                
                <InputField label="Descripción del Tipo (ej. Precio fijo único)" field="type" />
                
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Modelo de Precio (Interno)</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={formData.pricingModel}
                    onChange={e => setFormData({ ...formData, pricingModel: e.target.value })}
                  >
                    <option value="FIXED">Fijo</option>
                    <option value="INDEXED">Indexado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Tarifa</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={formData.tariff}
                    onChange={e => setFormData({ ...formData, tariff: e.target.value })}
                  >
                    <option value="">Sin Tarifa</option>
                    <option value="2.0TD">2.0TD</option>
                    <option value="3.0TD">3.0TD</option>
                    <option value="3.0TDVE">3.0TDVE</option>
                    <option value="6.1TD">6.1TD</option>
                  </select>
                </div>
                
                <InputField label="Permanencia (Meses)" field="permanenceMonths" type="number" />
              </div>

              <div className="flex flex-wrap gap-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500"
                    checked={formData.isAvailableCrm}
                    onChange={e => setFormData({ ...formData, isAvailableCrm: e.target.checked })}
                  />
                  <span className="text-sm text-slate-200">Disponible en CRM</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500"
                    checked={formData.gasIncluido}
                    onChange={e => setFormData({ ...formData, gasIncluido: e.target.checked })}
                  />
                  <span className="text-sm text-slate-200">Gas Incluido</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-500"
                    checked={formData.isCustomizable}
                    onChange={e => setFormData({ ...formData, isCustomizable: e.target.checked })}
                  />
                  <span className="text-sm text-slate-200">¿Es Personalizable?</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'potencia' && (
            <div className="grid grid-cols-3 gap-6">
              <InputField label="P1P (€/kW/año)" field="p1p" type="number" step="0.000001" />
              <InputField label="P2P (€/kW/año)" field="p2p" type="number" step="0.000001" />
              {formData.tariff !== '2.0TD' && (
                <>
                  <InputField label="P3P (€/kW/año)" field="p3p" type="number" step="0.000001" />
                  <InputField label="P4P (€/kW/año)" field="p4p" type="number" step="0.000001" />
                  <InputField label="P5P (€/kW/año)" field="p5p" type="number" step="0.000001" />
                  <InputField label="P6P (€/kW/año)" field="p6p" type="number" step="0.000001" />
                </>
              )}
            </div>
          )}

          {activeTab === 'energia' && (
            <div className="grid grid-cols-3 gap-6">
              <InputField label="P1E (€/kWh)" field="p1e" type="number" step="0.000001" />
              <InputField label="P2E (€/kWh)" field="p2e" type="number" step="0.000001" />
              <InputField label="P3E (€/kWh)" field="p3e" type="number" step="0.000001" />
              {formData.tariff !== '2.0TD' && (
                <>
                  <InputField label="P4E (€/kWh)" field="p4e" type="number" step="0.000001" />
                  <InputField label="P5E (€/kWh)" field="p5e" type="number" step="0.000001" />
                  <InputField label="P6E (€/kWh)" field="p6e" type="number" step="0.000001" />
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
                  onChange={e => setFormData({ ...formData, hasSelfConsumption: e.target.checked })}
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
                      onChange={e => setFormData({ ...formData, selfConsumptionType: e.target.value })}
                    >
                      <option value="No aplica">No aplica</option>
                      <option value="Con excedentes">Con excedentes</option>
                      <option value="Precio fijo">Precio Fijo</option>
                    </select>
                  </div>
                  <InputField label="PExc - Precio Excedentes (€/MWh)" field="pexc" type="number" step="0.01" />
                  <InputField label="Fee Excedentes (€/MWh)" field="feeExcedentes" type="number" step="0.01" />
                  <InputField label="CG Bolsillo Solar (€)" field="cgBolsilloSolar" type="number" step="0.01" />
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
                    onChange={e => setFormData({ ...formData, commissionType: e.target.value })}
                  >
                    <option value="MARGIN_PERCENTAGE">% sobre Margen</option>
                    <option value="POWER_TIERS">Por Tramos (Potencia)</option>
                  </select>
                </div>
                <InputField label="Fee Energía (€/MWh)" field="fee" type="number" step="0.01" />
                <InputField label="Coste Desvío (DSV) (€/MWh)" field="deviationCost" type="number" step="0.01" />
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Producto'}
          </button>
        </div>
      </div>
    </div>
  );
}
