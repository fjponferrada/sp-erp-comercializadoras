'use client';

import { useState, useMemo } from 'react';
import { X, Save, AlertCircle, Plus, Search, Trash2 } from 'lucide-react';

const TARIFF_GROUPS = ['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD'];

function isProductIndexed(p: any): boolean {
  return p?.pricingModel === 'INDEXED' || Boolean(p?.type && p.type.toLowerCase().includes('index'));
}

function isProductFixed(p: any): boolean {
  if (isProductIndexed(p)) return false;
  return p?.pricingModel === 'FIXED' || Boolean(p?.type && p.type.toLowerCase().includes('fijo'));
}

export default function ChannelModal({
  channel,
  commissionTiers,
  availableProducts = [],
  canEdit = true,
  onClose,
  onSaved,
}: any) {
  const [formData, setFormData] = useState({
    nombre: channel?.nombre || '',
    codigo: channel?.codigo || '',
    comisionFijo: channel?.comisionFijo || 0,
    comisionVariable: channel?.comisionVariable || 0,
    email: channel?.email === '—' ? '' : channel?.email || '',
    adminEmail: channel?.adminEmail || '',
    managerEmail: channel?.managerEmail || '',
    supportEmail: channel?.supportEmail || '',
    autoGenerateContract: channel?.autoGenerateContract || false,
    maxRenewalDays: channel?.maxRenewalDays ?? 45,
    commissionTierId: channel?.commissionTierId || '',
  });

  const [assignedProducts, setAssignedProducts] = useState<any[]>(channel?.products || []);
  const [productSearch, setProductSearch] = useState('');
  const [productTariffFilter, setProductTariffFilter] = useState('');

  const assignedIds = useMemo(() => new Set(assignedProducts.map((p: any) => p.id)), [assignedProducts]);

  const unassignedCandidates = useMemo(() => {
    return availableProducts.filter((p: any) => {
      if (assignedIds.has(p.id)) return false;
      if (productTariffFilter && p.tariff !== productTariffFilter) return false;
      if (productSearch && !(p.name || '').toLowerCase().includes(productSearch.toLowerCase())) return false;
      return true;
    });
  }, [availableProducts, assignedIds, productTariffFilter, productSearch]);

  const handleAddProduct = (product: any) => {
    if (!canEdit) return;
    setAssignedProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
  };

  const handleAddAllFiltered = () => {
    if (!canEdit || unassignedCandidates.length === 0) return;
    setAssignedProducts((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const toAdd = unassignedCandidates.filter((p: any) => !existing.has(p.id));
      return [...prev, ...toAdd];
    });
  };

  const handleRemoveProduct = (productId: string) => {
    if (!canEdit) return;
    setAssignedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleClearAllProducts = () => {
    if (!canEdit) return;
    setAssignedProducts([]);
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      setSaving(true);
      setError('');

      if (!formData.nombre.trim() || !formData.codigo.trim()) {
        throw new Error('El nombre y el código del canal son obligatorios.');
      }

      const isNew = !channel?.id;
      const url = isNew ? '/api/channels' : `/api/channels/${channel.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const payload = { ...formData, productIds: assignedProducts.map((p) => p.id) };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar el canal');
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-bottom-4 zoom-in-95">
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/30">
          <div>
            <h2 className="text-lg font-bold text-white">
              {!canEdit ? 'Ficha de Canal' : channel ? 'Editar Canal' : 'Nuevo Canal'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {!canEdit
                ? 'Vista de solo lectura de configuración y productos habilitados'
                : channel
                  ? 'Modifica la información, nivel de comisión y catálogo asignado al canal'
                  : 'Añade un nuevo colaborador comercial a la marca activa'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto max-h-[74vh] flex flex-col gap-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <fieldset disabled={!canEdit} className="contents">
            {/* Sección 1: General */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Datos Generales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre del Canal</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Comercializadora Sur"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Código (ID Único)</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Ej. SUR"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nivel de Comisión</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.commissionTierId}
                    onChange={(e) => setFormData({ ...formData, commissionTierId: e.target.value })}
                  >
                    <option value="">Selecciona un nivel...</option>
                    {commissionTiers?.map((tier: any) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Sección 2: Contactos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Directorios de Contacto</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Supervisor</label>
                  <input
                    type="email"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Administración</label>
                  <input
                    type="email"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Gerencia</label>
                  <input
                    type="email"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.managerEmail}
                    onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Atención al Cliente</label>
                  <input
                    type="email"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.supportEmail}
                    onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Sección 3: Opciones */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Configuración Avanzada</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-lime-500 focus:ring-lime-500"
                    checked={formData.autoGenerateContract}
                    onChange={(e) => setFormData({ ...formData, autoGenerateContract: e.target.checked })}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">Generar Contratos Auto.</span>
                    <span className="text-xs text-slate-400">Generación directa desde Leads</span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Días Máx. Renovación</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                    value={formData.maxRenewalDays}
                    onChange={(e) => setFormData({ ...formData, maxRenewalDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </fieldset>

          <hr className="border-slate-800" />

          {/* Sección 4: Productos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider">
                Productos Asignados ({assignedProducts.length})
              </h3>
              {canEdit && assignedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllProducts}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={12} /> Quitar todos
                </button>
              )}
            </div>

            {/* Buscador / Selector para añadir productos del catálogo */}
            {canEdit && (
              <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto del catálogo para asignar..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500"
                    />
                  </div>
                  <select
                    value={productTariffFilter}
                    onChange={(e) => setProductTariffFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="">Todas las tarifas</option>
                    {TARIFF_GROUPS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {unassignedCandidates.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddAllFiltered}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-lime-500/15 text-lime-300 border border-lime-500/30 hover:bg-lime-500/25 transition-colors"
                    >
                      <Plus size={12} /> Añadir visibles ({unassignedCandidates.length})
                    </button>
                  )}
                </div>

                {unassignedCandidates.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
                    {unassignedCandidates.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-lime-500/50 transition-colors text-left"
                      >
                        <Plus size={11} className="text-lime-400 shrink-0" />
                        <span className="font-mono text-[10px] text-slate-400">{p.tariff || '—'}</span>
                        <span>{p.name}</span>
                        {!p.isAvailableCrm && <span className="text-[10px] text-amber-400">(Oculto CRM)</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    {availableProducts.length === 0
                      ? 'No hay productos en el catálogo de esta marca.'
                      : 'Todos los productos coincidentes ya están asignados a este canal.'}
                  </p>
                )}
              </div>
            )}

            {/* Árbol agrupado de productos asignados */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col gap-4">
              {assignedProducts && assignedProducts.length > 0 ? (
                <>
                  {TARIFF_GROUPS.map((tariff) => {
                    const tariffProducts = assignedProducts
                      .filter((p: any) => p.tariff === tariff)
                      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
                    if (tariffProducts.length === 0) return null;

                    const fijos = tariffProducts.filter(isProductFixed);
                    const indexados = tariffProducts.filter(isProductIndexed);
                    const otros = tariffProducts.filter((p: any) => !isProductFixed(p) && !isProductIndexed(p));

                    const fijosSin = fijos.filter((p: any) => !p.hasSelfConsumption);
                    const fijosCon = fijos.filter((p: any) => p.hasSelfConsumption);
                    const indSin = indexados.filter((p: any) => !p.hasSelfConsumption);
                    const indCon = indexados.filter((p: any) => p.hasSelfConsumption);

                    return (
                      <div key={tariff} className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/60">
                        <h4 className="text-sm font-bold text-lime-400 uppercase tracking-wide border-b border-slate-700/60 pb-2 mb-3">
                          {tariff}
                        </h4>

                        <div className="grid grid-cols-2 gap-6">
                          {/* Columna Fijos */}
                          <div className="flex flex-col gap-3">
                            <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/40 pb-1">
                              Fijos
                            </h5>
                            {fijos.length === 0 ? (
                              <span className="text-xs text-slate-500 italic">No hay productos fijos</span>
                            ) : (
                              <>
                                {fijosSin.length > 0 && (
                                  <div className="flex flex-col gap-1.5">
                                    <h6 className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                                      Sin Autoconsumo
                                    </h6>
                                    {fijosSin.map((p: any) => (
                                      <span
                                        key={p.id}
                                        className="group relative inline-flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 break-words text-left"
                                      >
                                        <span>{p.name}</span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveProduct(p.id)}
                                            className="opacity-70 group-hover:opacity-100 transition-opacity ml-1.5 p-0.5 text-blue-400 hover:bg-red-500/20 hover:text-red-400 rounded"
                                          >
                                            <X size={12} />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {fijosCon.length > 0 && (
                                  <div className="flex flex-col gap-1.5 mt-2">
                                    <h6 className="text-[10px] text-amber-500/90 font-medium uppercase tracking-wide flex items-center gap-1">
                                      Con Autoconsumo <span className="text-[10px]">☀️</span>
                                    </h6>
                                    {fijosCon.map((p: any) => (
                                      <span
                                        key={p.id}
                                        className="group relative inline-flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 break-words text-left"
                                      >
                                        <span>{p.name}</span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveProduct(p.id)}
                                            className="opacity-70 group-hover:opacity-100 transition-opacity ml-1.5 p-0.5 text-blue-400 hover:bg-red-500/20 hover:text-red-400 rounded"
                                          >
                                            <X size={12} />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Columna Indexados */}
                          <div className="flex flex-col gap-3">
                            <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/40 pb-1">
                              Indexados
                            </h5>
                            {indexados.length === 0 ? (
                              <span className="text-xs text-slate-500 italic">No hay productos indexados</span>
                            ) : (
                              <>
                                {indSin.length > 0 && (
                                  <div className="flex flex-col gap-1.5">
                                    <h6 className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                                      Sin Autoconsumo
                                    </h6>
                                    {indSin.map((p: any) => (
                                      <span
                                        key={p.id}
                                        className="group relative inline-flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 break-words text-left"
                                      >
                                        <span>{p.name}</span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveProduct(p.id)}
                                            className="opacity-70 group-hover:opacity-100 transition-opacity ml-1.5 p-0.5 text-emerald-400 hover:bg-red-500/20 hover:text-red-400 rounded"
                                          >
                                            <X size={12} />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {indCon.length > 0 && (
                                  <div className="flex flex-col gap-1.5 mt-2">
                                    <h6 className="text-[10px] text-amber-500/90 font-medium uppercase tracking-wide flex items-center gap-1">
                                      Con Autoconsumo <span className="text-[10px]">☀️</span>
                                    </h6>
                                    {indCon.map((p: any) => (
                                      <span
                                        key={p.id}
                                        className="group relative inline-flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 break-words text-left"
                                      >
                                        <span>{p.name}</span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveProduct(p.id)}
                                            className="opacity-70 group-hover:opacity-100 transition-opacity ml-1.5 p-0.5 text-emerald-400 hover:bg-red-500/20 hover:text-red-400 rounded"
                                          >
                                            <X size={12} />
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Otros */}
                        {otros.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60">
                            <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Otros</h5>
                            <div className="flex flex-wrap gap-1.5">
                              {otros.map((p: any) => (
                                <span
                                  key={p.id}
                                  className="group relative inline-flex items-center px-2 py-1.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600"
                                >
                                  {p.name}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProduct(p.id)}
                                      className="opacity-70 group-hover:opacity-100 transition-opacity ml-1.5 p-0.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 rounded"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(() => {
                    const otherProducts = assignedProducts
                      .filter((p: any) => !TARIFF_GROUPS.includes(p.tariff))
                      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
                    if (otherProducts.length === 0) return null;
                    return (
                      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/60">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide border-b border-slate-700/60 pb-2 mb-3">
                          OTRAS TARIFAS
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {otherProducts.map((p: any) => (
                            <span
                              key={p.id}
                              className="group relative inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600"
                            >
                              {p.name}
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(p.id)}
                                  className="opacity-70 group-hover:opacity-100 transition-opacity ml-1.5 p-0.5 text-slate-300 hover:bg-red-500/20 hover:text-red-400 rounded"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-sm text-slate-500 italic text-center py-2">
                  No hay productos asignados a este canal.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-3">
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
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-slate-900 bg-lime-400 hover:bg-lime-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Canal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
