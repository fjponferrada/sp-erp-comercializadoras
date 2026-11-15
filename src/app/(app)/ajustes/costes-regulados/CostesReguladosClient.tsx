'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Save, Plus, Trash2, Edit2, Loader2, Zap, X, Check } from 'lucide-react';
import Topbar from '@/components/Topbar';

const DEFAULT_CONCEPT_SUGGESTIONS = [
  'Peajes_Energia',
  'Cargos_Energia',
  'Peajes_Potencia',
  'Cargos_Potencia',
  'PERDIDAS',
  'Pagos_Capacidad',
  'FNEE',
  'Pago_OM',
  'Pago_OS',
];

const TARIFF_OPTIONS = ['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD', 'TODAS'];

function toIsoDateInput(val: any): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function CostesReguladosClient() {
  const [activeTab, setActiveTab] = useState<'regulados' | 'futuros'>('regulados');
  const [loading, setLoading] = useState(true);

  const [regulated, setRegulated] = useState<any[]>([]);
  const [regulatedDaily, setRegulatedDaily] = useState<any[]>([]);
  const [futures, setFutures] = useState<any[]>([]);
  const [editedFutures, setEditedFutures] = useState<any[]>([]);
  const [savingFutures, setSavingFutures] = useState(false);
  const [futuresSyncMsg, setFuturesSyncMsg] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [activeYear, setActiveYear] = useState(currentYear);
  const [activeRegulatedYear, setActiveRegulatedYear] = useState<number>(currentYear);
  const [availableRegulatedYears, setAvailableRegulatedYears] = useState<number[]>([currentYear + 1, currentYear]);

  // Nuevo Coste Diario
  const [newDailyCost, setNewDailyCost] = useState({
    concept: 'Bono_Social',
    amount: '',
    label: '',
    validFrom: '',
    validTo: '',
  });

  // Edición inline de Coste Diario
  const [editingDailyId, setEditingDailyId] = useState<string | null>(null);
  const [editingDailyForm, setEditingDailyForm] = useState({
    concept: '',
    amount: '',
    label: '',
    validFrom: '',
    validTo: '',
  });

  // Modal Crear / Editar Coste Regulado (Matriz)
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [savingRegModal, setSavingRegModal] = useState(false);
  const [regModalError, setRegModalError] = useState<string | null>(null);
  const [regModalMode, setRegModalMode] = useState<'periods' | 'single'>('periods');
  const [regForm, setRegForm] = useState({
    id: '',
    concept: 'Peajes_Energia',
    tariff: '2.0TD',
    validFrom: `${currentYear}-01-01`,
    validTo: `${currentYear}-12-31`,
    p1: '',
    p2: '',
    p3: '',
    p4: '',
    p5: '',
    p6: '',
    singleValue: '',
  });

  const conceptSuggestions = useMemo(() => {
    const existing = regulated.map((r: any) => String(r.concept || '')).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CONCEPT_SUGGESTIONS, ...existing]));
  }, [regulated]);

  useEffect(() => {
    fetchData(true);
  }, []);

  const fetchData = async (initialLoad = false) => {
    setLoading(true);
    try {
      const [resReg, resDaily, resFut] = await Promise.all([
        fetch('/api/settings/regulated-costs'),
        fetch('/api/settings/regulated-daily-costs'),
        fetch('/api/settings/future-prices'),
      ]);
      const futuresData = resFut.ok ? await resFut.json() : [];
      const regData = resReg.ok ? await resReg.json() : [];
      const dailyData = resDaily.ok ? await resDaily.json() : [];

      setRegulated(Array.isArray(regData) ? regData : []);
      setRegulatedDaily(Array.isArray(dailyData) ? dailyData : []);
      setFutures(Array.isArray(futuresData) ? futuresData : []);

      const dbYears = (Array.isArray(regData) ? regData : []).map((r: any) => new Date(r.validFrom).getFullYear());
      const mergedYears = Array.from(new Set([currentYear + 1, currentYear, ...dbYears]))
        .filter((y) => Number.isFinite(y))
        .sort((a, b) => b - a);
      setAvailableRegulatedYears(mergedYears);

      if (initialLoad) {
        if (dbYears.includes(currentYear)) {
          setActiveRegulatedYear(currentYear);
        } else if (dbYears.length > 0) {
          setActiveRegulatedYear(Math.max(...dbYears));
        } else {
          setActiveRegulatedYear(currentYear);
        }
      }

      buildEditedFutures(Array.isArray(futuresData) ? futuresData : [], activeYear);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteRegulated = async (id: string) => {
    if (!confirm('¿Eliminar este coste regulado?')) return;
    await fetch(`/api/settings/regulated-costs?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const openNewRegulatedModal = () => {
    setRegModalError(null);
    setRegModalMode('periods');
    setRegForm({
      id: '',
      concept: 'Peajes_Energia',
      tariff: '2.0TD',
      validFrom: `${activeRegulatedYear}-01-01`,
      validTo: `${activeRegulatedYear}-12-31`,
      p1: '',
      p2: '',
      p3: '',
      p4: '',
      p5: '',
      p6: '',
      singleValue: '',
    });
    setIsRegModalOpen(true);
  };

  const openEditRegulatedModal = (r: any) => {
    const hasSingle = r.singleValue !== null && r.singleValue !== undefined;
    setRegModalError(null);
    setRegModalMode(hasSingle ? 'single' : 'periods');
    setRegForm({
      id: r.id,
      concept: r.concept || '',
      tariff: r.tariff || '2.0TD',
      validFrom: toIsoDateInput(r.validFrom),
      validTo: toIsoDateInput(r.validTo),
      p1: r.p1 ?? '',
      p2: r.p2 ?? '',
      p3: r.p3 ?? '',
      p4: r.p4 ?? '',
      p5: r.p5 ?? '',
      p6: r.p6 ?? '',
      singleValue: r.singleValue ?? '',
    });
    setIsRegModalOpen(true);
  };

  const handleSaveRegulatedModal = async () => {
    try {
      setSavingRegModal(true);
      setRegModalError(null);

      if (!regForm.concept.trim() || !regForm.tariff.trim() || !regForm.validFrom || !regForm.validTo) {
        throw new Error('Concepto, tarifa, fecha de inicio y fecha de fin son obligatorios.');
      }

      const payload = {
        ...(regForm.id ? { id: regForm.id } : {}),
        concept: regForm.concept.trim(),
        tariff: regForm.tariff.trim().toUpperCase(),
        validFrom: regForm.validFrom,
        validTo: regForm.validTo,
        p1: regModalMode === 'periods' ? regForm.p1 : null,
        p2: regModalMode === 'periods' ? regForm.p2 : null,
        p3: regModalMode === 'periods' ? regForm.p3 : null,
        p4: regModalMode === 'periods' ? regForm.p4 : null,
        p5: regModalMode === 'periods' ? regForm.p5 : null,
        p6: regModalMode === 'periods' ? regForm.p6 : null,
        singleValue: regModalMode === 'single' ? regForm.singleValue : null,
      };

      const res = await fetch('/api/settings/regulated-costs', {
        method: regForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error guardando el coste regulado');
      }

      const savedYear = new Date(regForm.validFrom).getFullYear();
      if (Number.isFinite(savedYear)) {
        setActiveRegulatedYear(savedYear);
      }
      setIsRegModalOpen(false);
      await fetchData();
    } catch (e: any) {
      setRegModalError(e.message || 'Error guardando el coste regulado');
    } finally {
      setSavingRegModal(false);
    }
  };

  const deleteDailyCost = async (id: string) => {
    if (!confirm('¿Eliminar este coste diario?')) return;
    await fetch(`/api/settings/regulated-daily-costs?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const saveNewDailyCost = async () => {
    if (!newDailyCost.concept.trim() || !newDailyCost.amount || !newDailyCost.validFrom) {
      return alert('Concepto, importe y fecha de inicio son obligatorios');
    }
    const res = await fetch('/api/settings/regulated-daily-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDailyCost),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert(err.error || 'Error al guardar coste diario');
    }
    setNewDailyCost({ concept: 'Bono_Social', amount: '', label: '', validFrom: '', validTo: '' });
    fetchData();
  };

  const startEditDailyCost = (r: any) => {
    setEditingDailyId(r.id);
    setEditingDailyForm({
      concept: r.concept || '',
      amount: String(r.amount ?? ''),
      label: r.label || '',
      validFrom: toIsoDateInput(r.validFrom),
      validTo: toIsoDateInput(r.validTo),
    });
  };

  const saveEditedDailyCost = async () => {
    if (!editingDailyId) return;
    if (!editingDailyForm.concept.trim() || !editingDailyForm.amount || !editingDailyForm.validFrom) {
      return alert('Concepto, importe y fecha de inicio son obligatorios');
    }
    const res = await fetch('/api/settings/regulated-daily-costs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingDailyId, ...editingDailyForm }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert(err.error || 'Error al actualizar coste diario');
    }
    setEditingDailyId(null);
    fetchData();
  };

  const buildEditedFutures = (data: any[], year: number) => {
    const newEdited = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = year * 100 + m;
      const existing = data.find((f) => f.month === monthKey);
      if (existing) {
        newEdited.push({ ...existing });
      } else {
        newEdited.push({ id: `new_${monthKey}`, month: monthKey, price: 0, isNew: true });
      }
    }
    setEditedFutures(newEdited);
  };

  useEffect(() => {
    buildEditedFutures(futures, activeYear);
  }, [activeYear, futures]);

  const handleFutureChange = (id: string, newPrice: string) => {
    setEditedFutures((prev) => prev.map((f) => (f.id === id ? { ...f, price: parseFloat(newPrice) || 0 } : f)));
  };

  const saveFutures = async () => {
    setSavingFutures(true);
    setFuturesSyncMsg(null);
    try {
      const promises = editedFutures.map((ef) => {
        if (ef.isNew) {
          if (!ef.price || ef.price <= 0) return Promise.resolve();
          return fetch('/api/settings/future-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: ef.month, price: ef.price }),
          });
        } else {
          const original = futures.find((f) => f.id === ef.id);
          if (original && original.price !== ef.price) {
            return fetch('/api/settings/future-prices', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: ef.id, price: ef.price }),
            });
          }
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      await fetchData();

      const syncRes = await fetch('/api/cron/update-portfolio', { method: 'POST' });
      const syncJson = await syncRes.json().catch(() => null);
      if (syncRes.ok && syncJson?.success) {
        setFuturesSyncMsg('Futuros guardados y Curva Base del Portfolio (Pricing + Proyecciones PPA) actualizada al instante.');
      } else {
        setFuturesSyncMsg('Futuros guardados. Recuerda sincronizar el Portfolio en Pricing o PPAs si no se actualizó automáticamente.');
      }
    } catch (e) {
      console.error(e);
      alert('Error al guardar los futuros');
    } finally {
      setSavingFutures(false);
    }
  };

  const filteredRegulated = regulated.filter((r) => new Date(r.validFrom).getFullYear() === activeRegulatedYear);
  const groupedRegulated = filteredRegulated.reduce((acc, r) => {
    if (!acc[r.concept]) acc[r.concept] = [];
    acc[r.concept].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  const tariffOrder = ['2.0TD', '3.0TD', '6.1TD', '6.2TD', '6.3TD', '6.4TD', '3.0TDVE', '6.1TDVE', 'TODAS'];
  Object.keys(groupedRegulated).forEach((concept) => {
    groupedRegulated[concept].sort((a: any, b: any) => {
      let indexA = tariffOrder.indexOf(String(a.tariff || '').toUpperCase());
      let indexB = tariffOrder.indexOf(String(b.tariff || '').toUpperCase());
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      return indexA - indexB;
    });
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '60px' }}>
      <Topbar title="Configuración de Motor Pricing" subtitle="Gestiona Costes Regulados BOE, Tasas Diarias y Futuros OMIE" />

      <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '0 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: '24px',
              background: 'var(--bg-elevated)',
            }}
          >
            <button
              onClick={() => setActiveTab('regulados')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 4px',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                color: activeTab === 'regulados' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'regulados' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Settings size={18} />
              Costes Regulados y Tasas
            </button>
            <button
              onClick={() => setActiveTab('futuros')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 4px',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                color: activeTab === 'futuros' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'futuros' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Zap size={18} />
              Precios Futuros OMIE
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 className="animate-spin text-gray-500" />
              </div>
            ) : (
              <>
                {activeTab === 'regulados' && (
                  <div className="space-y-8 animate-in fade-in">
                    {/* Costes Diarios */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-200">Costes Diarios Regulados (por CUPS)</h3>
                      </div>
                      <div className="overflow-x-auto" style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Concepto</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Descripción (PDF)</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Coste Diario (€/día)</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Válido Desde</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Válido Hasta</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {regulatedDaily.map((r: any) => {
                              const isRowEditing = editingDailyId === r.id;
                              if (isRowEditing) {
                                return (
                                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }} className="bg-indigo-950/20">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        className="w-full p-1.5 text-sm bg-gray-900 border border-indigo-500/50 rounded text-white"
                                        value={editingDailyForm.concept}
                                        onChange={(e) => setEditingDailyForm({ ...editingDailyForm, concept: e.target.value })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        className="w-full p-1.5 text-sm bg-gray-900 border border-indigo-500/50 rounded text-white"
                                        value={editingDailyForm.label}
                                        onChange={(e) => setEditingDailyForm({ ...editingDailyForm, label: e.target.value })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="0.000001"
                                        className="w-full p-1.5 text-sm bg-gray-900 border border-indigo-500/50 rounded text-white font-mono"
                                        value={editingDailyForm.amount}
                                        onChange={(e) => setEditingDailyForm({ ...editingDailyForm, amount: e.target.value })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="date"
                                        className="w-full p-1.5 text-sm bg-gray-900 border border-indigo-500/50 rounded text-white"
                                        value={editingDailyForm.validFrom}
                                        onChange={(e) => setEditingDailyForm({ ...editingDailyForm, validFrom: e.target.value })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="date"
                                        className="w-full p-1.5 text-sm bg-gray-900 border border-indigo-500/50 rounded text-white"
                                        value={editingDailyForm.validTo}
                                        onChange={(e) => setEditingDailyForm({ ...editingDailyForm, validTo: e.target.value })}
                                      />
                                    </td>
                                    <td className="p-2 text-right whitespace-nowrap">
                                      <button
                                        onClick={saveEditedDailyCost}
                                        className="text-emerald-400 hover:text-emerald-300 p-1.5"
                                        title="Guardar cambios"
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button
                                        onClick={() => setEditingDailyId(null)}
                                        className="text-gray-400 hover:text-white p-1.5"
                                        title="Cancelar"
                                      >
                                        <X size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-gray-800/30">
                                  <td className="p-3 text-sm font-bold text-[var(--primary)]">{r.concept}</td>
                                  <td className="p-3 text-sm text-gray-400">{r.label || '-'}</td>
                                  <td className="p-3 text-sm text-gray-300 font-mono">{Number(r.amount).toFixed(6)} €</td>
                                  <td className="p-3 text-sm text-gray-400 whitespace-nowrap">
                                    {new Date(r.validFrom).toLocaleDateString()}
                                  </td>
                                  <td className="p-3 text-sm text-gray-400 whitespace-nowrap">
                                    {r.validTo ? new Date(r.validTo).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="p-3 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => startEditDailyCost(r)}
                                      className="text-gray-400 hover:text-white p-1 mr-1"
                                      title="Editar coste diario"
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button
                                      onClick={() => deleteDailyCost(r.id)}
                                      className="text-red-400 hover:text-red-300 p-1"
                                      title="Eliminar coste diario"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-800/20">
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="Bono_Social"
                                  className="w-full p-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                                  value={newDailyCost.concept}
                                  onChange={(e) => setNewDailyCost({ ...newDailyCost, concept: e.target.value })}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="Ej: Financiación del Bono Social..."
                                  className="w-full p-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                                  value={newDailyCost.label}
                                  onChange={(e) => setNewDailyCost({ ...newDailyCost, label: e.target.value })}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.000001"
                                  placeholder="0.000000"
                                  className="w-full p-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white font-mono"
                                  value={newDailyCost.amount}
                                  onChange={(e) => setNewDailyCost({ ...newDailyCost, amount: e.target.value })}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  className="w-full p-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                                  value={newDailyCost.validFrom}
                                  onChange={(e) => setNewDailyCost({ ...newDailyCost, validFrom: e.target.value })}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  className="w-full p-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white"
                                  value={newDailyCost.validTo}
                                  onChange={(e) => setNewDailyCost({ ...newDailyCost, validTo: e.target.value })}
                                />
                              </td>
                              <td className="p-2 text-right">
                                <button
                                  onClick={saveNewDailyCost}
                                  className="p-1.5 bg-[var(--lime)] text-black rounded hover:opacity-90 font-semibold inline-flex items-center justify-center"
                                  title="Añadir coste diario"
                                >
                                  <Plus size={16} />
                                </button>
                              </td>
                            </tr>
                            {regulatedDaily.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                  No hay datos de costes diarios.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Matriz de Periodos */}
                    <div>
                      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-bold text-gray-200">Matriz de Costes Regulados</h3>
                          <select
                            value={activeRegulatedYear}
                            onChange={(e) => setActiveRegulatedYear(parseInt(e.target.value, 10))}
                            style={{
                              background: 'var(--bg-base)',
                              color: 'var(--text-primary)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {availableRegulatedYears.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={openNewRegulatedModal}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 14px',
                            background: 'var(--lime)',
                            color: 'var(--bg-base)',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={16} />
                          Nuevo Coste Regulado
                        </button>
                      </div>

                      <div className="overflow-x-auto" style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Tarifa</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase">Vigencia</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-center">P1</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-center">P2</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-center">P3</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-center">P4</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-center">P5</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-center">P6</th>
                              <th className="p-3 text-xs text-gray-400 font-bold uppercase text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(groupedRegulated).map(([concept, records]) => (
                              <React.Fragment key={concept}>
                                <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                                  <td
                                    colSpan={9}
                                    className="p-3 text-sm font-bold text-[var(--primary)] uppercase tracking-wider bg-gray-800/40"
                                  >
                                    {concept}
                                  </td>
                                </tr>
                                {(records as any[]).map((r: any) => {
                                  const hasSingle = r.singleValue !== null && r.singleValue !== undefined;
                                  return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-gray-800/30">
                                      <td className="p-3 text-sm text-gray-300">
                                        <span className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs">{r.tariff}</span>
                                      </td>
                                      <td className="p-3 text-xs text-gray-400 whitespace-nowrap">
                                        {new Date(r.validFrom).toLocaleDateString()} —{' '}
                                        {r.validTo ? new Date(r.validTo).toLocaleDateString() : '-'}
                                      </td>
                                      {hasSingle ? (
                                        <td colSpan={6} className="p-3 text-sm text-[var(--primary)] font-bold text-center font-mono">
                                          Valor único: {r.singleValue}
                                        </td>
                                      ) : (
                                        <>
                                          <td className="p-3 text-sm text-gray-300 font-mono text-center">{r.p1 ?? '-'}</td>
                                          <td className="p-3 text-sm text-gray-300 font-mono text-center">{r.p2 ?? '-'}</td>
                                          <td className="p-3 text-sm text-gray-300 font-mono text-center">{r.p3 ?? '-'}</td>
                                          <td className="p-3 text-sm text-gray-300 font-mono text-center">{r.p4 ?? '-'}</td>
                                          <td className="p-3 text-sm text-gray-300 font-mono text-center">{r.p5 ?? '-'}</td>
                                          <td className="p-3 text-sm text-gray-300 font-mono text-center">{r.p6 ?? '-'}</td>
                                        </>
                                      )}
                                      <td className="p-3 text-right whitespace-nowrap">
                                        <button
                                          onClick={() => openEditRegulatedModal(r)}
                                          className="text-gray-400 hover:text-white p-1 mr-1"
                                          title="Editar registro"
                                        >
                                          <Edit2 size={15} />
                                        </button>
                                        <button
                                          onClick={() => deleteRegulated(r.id)}
                                          className="text-red-400 hover:text-red-300 p-1"
                                          title="Eliminar registro"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                            {filteredRegulated.length === 0 && (
                              <tr>
                                <td colSpan={9} className="p-8 text-center text-gray-500">
                                  No hay datos de costes regulados para {activeRegulatedYear}. Usa <strong>Nuevo Coste Regulado</strong>{' '}
                                  para añadir tarifas BOE.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'futuros' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-200">Precios Objetivo Futuros (€/MWh)</h3>
                        <select
                          value={activeYear}
                          onChange={(e) => setActiveYear(parseInt(e.target.value, 10))}
                          style={{
                            background: 'var(--bg-base)',
                            color: 'var(--text-primary)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={saveFutures}
                        disabled={savingFutures}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          background: 'var(--lime)',
                          color: 'var(--bg-base)',
                          borderRadius: '8px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: savingFutures ? 'wait' : 'pointer',
                        }}
                      >
                        {savingFutures ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {savingFutures ? 'Guardando y sincronizando Curva...' : 'Guardar y Sincronizar Portfolio'}
                      </button>
                    </div>

                    {futuresSyncMsg && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          background: 'rgba(34, 197, 94, 0.1)',
                          border: '1px solid rgba(34, 197, 94, 0.35)',
                          color: '#4ADE80',
                          fontSize: '0.85rem',
                        }}
                      >
                        {futuresSyncMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {editedFutures.map((f) => {
                        const mNum = f.month % 100;
                        return (
                          <div
                            key={f.id}
                            className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-elevated)] flex flex-col justify-between items-center relative group"
                          >
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">
                              Mes {String(mNum).padStart(2, '0')}
                            </span>
                            <input
                              type="number"
                              value={f.price}
                              onChange={(e) => handleFutureChange(f.id, e.target.value)}
                              className="text-2xl font-black text-[var(--lime)] bg-transparent border-b border-dashed border-gray-600 focus:border-[var(--lime)] outline-none text-center w-full"
                              style={{ WebkitAppearance: 'none', margin: 0, MozAppearance: 'textfield' }}
                            />
                            <span className="text-xs text-gray-500 mt-1">€ / MWh</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Crear / Editar Coste Regulado */}
      {isRegModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/40">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {regForm.id ? 'Editar Coste Regulado (BOE)' : 'Nuevo Coste Regulado (BOE)'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configura peajes, cargos, pérdidas, pagos por capacidad, FNEE o retribuciones OM/OS
                </p>
              </div>
              <button
                onClick={() => setIsRegModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {regModalError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {regModalError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Concepto BOE</label>
                  <input
                    list="boe-concept-suggestions"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={regForm.concept}
                    onChange={(e) => setRegForm({ ...regForm, concept: e.target.value })}
                    placeholder="Ej. Peajes_Energia, PERDIDAS, FNEE..."
                  />
                  <datalist id="boe-concept-suggestions">
                    {conceptSuggestions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tarifa ATR</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={regForm.tariff}
                    onChange={(e) => setRegForm({ ...regForm, tariff: e.target.value })}
                  >
                    {TARIFF_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Válido Desde</label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={regForm.validFrom}
                    onChange={(e) => setRegForm({ ...regForm, validFrom: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Válido Hasta</label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={regForm.validTo}
                    onChange={(e) => setRegForm({ ...regForm, validTo: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Formato del Valor</label>
                <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setRegModalMode('periods')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      regModalMode === 'periods' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Por Periodos (P1–P6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegModalMode('single')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      regModalMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Valor Único (Fijo)
                  </button>
                </div>
              </div>

              {regModalMode === 'periods' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const).map((periodKey) => (
                    <div key={periodKey}>
                      <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">{periodKey}</label>
                      <input
                        type="number"
                        step="0.000001"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                        value={regForm[periodKey]}
                        onChange={(e) => setRegForm({ ...regForm, [periodKey]: e.target.value })}
                        placeholder="0.000000"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Valor Único</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    value={regForm.singleValue}
                    onChange={(e) => setRegForm({ ...regForm, singleValue: e.target.value })}
                    placeholder="Ej. 0.000392"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800 bg-slate-800/30">
              <button
                type="button"
                onClick={() => setIsRegModalOpen(false)}
                disabled={savingRegModal}
                className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRegulatedModal}
                disabled={savingRegModal}
                className="px-5 py-2 text-sm font-semibold text-black bg-[var(--lime)] hover:opacity-90 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {savingRegModal ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingRegModal ? 'Guardando...' : 'Guardar Coste Regulado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
