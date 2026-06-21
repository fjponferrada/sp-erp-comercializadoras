import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

export default function RuleModal({ tierId, rule, onClose, onSaved, products = [], services = [] }: any) {
  const [formData, setFormData] = useState({
    tierId: tierId,
    tariff: rule?.tariff || '',
    productType: rule?.productType || '',
    productIds: rule?.products?.map((p: any) => p.id) || [],
    serviceIds: rule?.additionalServices?.map((s: any) => s.id) || [],
    powerMin: rule?.powerMin !== null && rule?.powerMin !== undefined ? rule.powerMin : '',
    powerMax: rule?.powerMax !== null && rule?.powerMax !== undefined ? rule.powerMax : '',
    commissionType: rule?.commissionType || 'PERCENTAGE',
    value: rule?.value !== null && rule?.value !== undefined ? rule.value : '',
  });

  const filteredProducts = products.filter((p: any) => {
    let match = true;
    if (formData.tariff && p.tariff && p.tariff !== formData.tariff) match = false;
    
    if (formData.productType) {
      const rType = formData.productType;
      const pTypeStr = (p.type || '').toLowerCase();
      
      if (rType === 'Fijo') {
        if (!pTypeStr.includes('fijo')) match = false;
      } else if (rType === 'Indexado' || rType === 'Index') {
        if (!pTypeStr.includes('indexado')) match = false;
      } else {
        if (rType !== p.type) match = false;
      }
    }
    return match;
  });

  const handleProductToggle = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id: string) => id !== productId)
        : [...prev.productIds, productId]
    }));
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id: string) => id !== serviceId)
        : [...prev.serviceIds, serviceId]
    }));
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      const isNew = !rule?.id;
      const url = isNew ? '/api/commission-rules' : `/api/commission-rules/${rule.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar la regla');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-bottom-4 zoom-in-95">
        
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/30">
          <div>
            <h2 className="text-lg font-bold text-white">{rule ? 'Editar Regla' : 'Nueva Regla'}</h2>
            <p className="text-xs text-slate-400 mt-1">Configura las condiciones bajo las cuales aplica esta comisión</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tarifa Específica</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={formData.tariff}
                onChange={e => {
                  setFormData({ ...formData, tariff: e.target.value, productIds: [] });
                }}
              >
                <option value="">Cualquiera</option>
                <option value="2.0TD">2.0TD</option>
                <option value="3.0TD">3.0TD</option>
                <option value="6.1TD">6.1TD</option>
                <option value="6.2TD">6.2TD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Producto</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={formData.productType}
                onChange={e => {
                  setFormData({ ...formData, productType: e.target.value, productIds: [] });
                }}
              >
                <option value="">Cualquiera</option>
                <optgroup label="Agrupaciones Generales">
                  <option value="Fijo">Todos los Fijos</option>
                  <option value="Indexado">Todos los Indexados</option>
                </optgroup>
                <optgroup label="Tipos Específicos">
                  <option value="Precio fijo único">Precio fijo único</option>
                  <option value="Precio fijo por periodo">Precio fijo por periodo</option>
                  <option value="Precio indexado Pass-Through">Precio indexado Pass-Through</option>
                  <option value="Precio indexado Pass-Through Personalizado">Precio indexado Pass-Through Personalizado</option>
                  <option value="Precio indexado Pass-Through Personalizado Exc Fijo">Precio indexado Pass-Through Personalizado Exc Fijo</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
              Productos Específicos (Opcional)
              <span className="text-[10px] text-indigo-400">Selecciona varios si lo deseas</span>
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto p-2">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No hay productos que coincidan con la tarifa y tipo seleccionados.</p>
              ) : (
                filteredProducts.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/50 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.productIds.includes(p.id)}
                      onChange={() => handleProductToggle(p.id)}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                    />
                    <span className="text-sm text-slate-300">{p.name} <span className="text-xs text-slate-500">({p.tariff || 'Sin tarifa'})</span></span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
              Servicios Adicionales (Opcional)
              <span className="text-[10px] text-indigo-400">Selecciona si la regla es específica para un servicio</span>
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto p-2">
              {services && services.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No hay servicios comisionables disponibles.</p>
              ) : (
                services && services.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/50 rounded cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.serviceIds.includes(s.id)}
                      onChange={() => handleServiceToggle(s.id)}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                    />
                    <span className="text-sm text-slate-300">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="p-4 border border-slate-800 rounded-xl bg-slate-800/20">
            <h4 className="text-xs font-semibold text-slate-300 mb-3">Tramos de Potencia Media (P1 y P2)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5">Potencia Mínima (kW) - Opcional</label>
                <input
                  type="number" step="0.01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  value={formData.powerMin}
                  onChange={e => setFormData({ ...formData, powerMin: e.target.value })}
                  placeholder="Ej. 0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5">Potencia Máxima (kW) - Opcional</label>
                <input
                  type="number" step="0.01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  value={formData.powerMax}
                  onChange={e => setFormData({ ...formData, powerMax: e.target.value })}
                  placeholder="Ej. 5"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">La potencia media es calculada como (P1 + P2) / 2</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Comisión</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={formData.commissionType}
                onChange={e => setFormData({ ...formData, commissionType: e.target.value })}
              >
                <option value="PERCENTAGE">% sobre el margen</option>
                <option value="FIXED">Euros fijos (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Valor Numérico</label>
              <input
                type="number" step="0.01"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                placeholder={formData.commissionType === 'PERCENTAGE' ? "Ej. 65" : "Ej. 135"}
              />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || formData.value === ''}
            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Regla'}
          </button>
        </div>
      </div>
    </div>
  );
}
