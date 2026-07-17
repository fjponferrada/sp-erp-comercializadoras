'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, Edit2, Loader2, Zap } from 'lucide-react';
import Topbar from '@/components/Topbar';

export default function ParametrosPricingPage() {
  const [activeTab, setActiveTab] = useState('regulados');
  const [loading, setLoading] = useState(true);
  
  const [regulated, setRegulated] = useState<any[]>([]);
  const [regulatedDaily, setRegulatedDaily] = useState<any[]>([]);
  const [futures, setFutures] = useState<any[]>([]);
  const [editedFutures, setEditedFutures] = useState<any[]>([]);
  const [savingFutures, setSavingFutures] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const [activeYear, setActiveYear] = useState(currentYear);
  
  const [activeRegulatedYear, setActiveRegulatedYear] = useState<number>(currentYear);
  const [availableRegulatedYears, setAvailableRegulatedYears] = useState<number[]>([currentYear]);

  const [newDailyCost, setNewDailyCost] = useState({
    concept: 'Bono_Social',
    amount: '',
    label: '',
    validFrom: '',
    validTo: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resReg, resDaily, resFut] = await Promise.all([
        fetch('/api/settings/regulated-costs'),
        fetch('/api/settings/regulated-daily-costs'),
        fetch('/api/settings/future-prices')
      ]);
      const futuresData = await resFut.json();
      const regData = await resReg.json();
      const dailyData = await resDaily.json();
      setRegulated(regData);
      setRegulatedDaily(dailyData);
      setFutures(futuresData);
      
      const years = Array.from(new Set(regData.map((r: any) => new Date(r.validFrom).getFullYear()))).sort((a: any, b: any) => b - a) as number[];
      if (years.length > 0) {
        setAvailableRegulatedYears(years);
        setActiveRegulatedYear(years[0]);
      } else {
        setAvailableRegulatedYears([currentYear]);
        setActiveRegulatedYear(currentYear);
      }
      buildEditedFutures(futuresData, activeYear);
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

  const deleteDailyCost = async (id: string) => {
    if (!confirm('¿Eliminar este coste diario?')) return;
    await fetch(`/api/settings/regulated-daily-costs?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const saveNewDailyCost = async () => {
    if (!newDailyCost.amount || !newDailyCost.validFrom) return alert('Importe y fecha de inicio obligatorios');
    await fetch('/api/settings/regulated-daily-costs', {
      method: 'POST',
      body: JSON.stringify(newDailyCost)
    });
    setNewDailyCost({ concept: 'Bono_Social', amount: '', label: '', validFrom: '', validTo: '' });
    fetchData();
  };

  const deleteFuture = async (id: string) => {
    if (!confirm('¿Eliminar este registro de futuros?')) return;
    await fetch(`/api/settings/future-prices?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const buildEditedFutures = (data: any[], year: number) => {
    const newEdited = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = year * 100 + m;
      const existing = data.find(f => f.month === monthKey);
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
  }, [activeYear]);

  const handleFutureChange = (id: string, newPrice: string) => {
    setEditedFutures(prev => prev.map(f => f.id === id ? { ...f, price: parseFloat(newPrice) || 0 } : f));
  };

  const saveFutures = async () => {
    setSavingFutures(true);
    try {
      const promises = editedFutures.map(ef => {
        if (ef.isNew) {
          return fetch('/api/settings/future-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: ef.month, price: ef.price })
          });
        } else {
          const original = futures.find(f => f.id === ef.id);
          if (original && original.price !== ef.price) {
            return fetch('/api/settings/future-prices', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: ef.id, price: ef.price })
            });
          }
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert('Error al guardar los futuros');
    } finally {
      setSavingFutures(false);
    }
  };

  const filteredRegulated = regulated.filter(r => new Date(r.validFrom).getFullYear() === activeRegulatedYear);
  const groupedRegulated = filteredRegulated.reduce((acc, r) => {
    if (!acc[r.concept]) acc[r.concept] = [];
    acc[r.concept].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  const tariffOrder = ["2.0TD", "3.0TD", "6.1TD", "6.2TD", "6.3TD", "6.4TD", "3.0TDVE", "6.1TDVE"];
  Object.keys(groupedRegulated).forEach(concept => {
    groupedRegulated[concept].sort((a: any, b: any) => {
      let indexA = tariffOrder.indexOf(a.tariff.toUpperCase());
      let indexB = tariffOrder.indexOf(b.tariff.toUpperCase());
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      return indexA - indexB;
    });
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '60px' }}>
      <Topbar title="Configuración de Motor Pricing" subtitle="Gestiona Costes Regulados, Tasas y Futuros OMIE" />
      
      <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '24px', background: 'var(--bg-elevated)' }}>
            <button
              onClick={() => setActiveTab('regulados')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 4px', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
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
                display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 4px', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
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
                            {regulatedDaily.map((r: any) => (
                              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-gray-800/30">
                                <td className="p-3 text-sm text-gray-300 font-bold text-[var(--primary)]">{r.concept}</td>
                                <td className="p-3 text-sm text-gray-400">{r.label || '-'}</td>
                                <td className="p-3 text-sm text-gray-300 font-mono">{r.amount.toFixed(6)} €</td>
                                <td className="p-3 text-sm text-gray-400 whitespace-nowrap">{new Date(r.validFrom).toLocaleDateString()}</td>
                                <td className="p-3 text-sm text-gray-400 whitespace-nowrap">{r.validTo ? new Date(r.validTo).toLocaleDateString() : '-'}</td>
                                <td className="p-3 text-right">
                                  <button onClick={() => deleteDailyCost(r.id)} className="text-red-400 hover:text-red-300 p-1">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-800/20">
                              <td className="p-2"><input type="text" placeholder="Bono_Social" className="w-full p-1 text-sm bg-gray-900 border border-gray-700 rounded" value={newDailyCost.concept} onChange={e => setNewDailyCost({...newDailyCost, concept: e.target.value})} /></td>
                              <td className="p-2"><input type="text" placeholder="Ej: Financiación del Bono Social..." className="w-full p-1 text-sm bg-gray-900 border border-gray-700 rounded" value={newDailyCost.label} onChange={e => setNewDailyCost({...newDailyCost, label: e.target.value})} /></td>
                              <td className="p-2"><input type="number" step="0.000001" placeholder="0.000000" className="w-full p-1 text-sm bg-gray-900 border border-gray-700 rounded" value={newDailyCost.amount} onChange={e => setNewDailyCost({...newDailyCost, amount: e.target.value})} /></td>
                              <td className="p-2"><input type="date" className="w-full p-1 text-sm bg-gray-900 border border-gray-700 rounded" value={newDailyCost.validFrom} onChange={e => setNewDailyCost({...newDailyCost, validFrom: e.target.value})} /></td>
                              <td className="p-2"><input type="date" className="w-full p-1 text-sm bg-gray-900 border border-gray-700 rounded" value={newDailyCost.validTo} onChange={e => setNewDailyCost({...newDailyCost, validTo: e.target.value})} /></td>
                              <td className="p-2 text-right"><button onClick={saveNewDailyCost} className="p-1 bg-[var(--primary)] text-white rounded hover:opacity-80"><Plus size={16}/></button></td>
                            </tr>
                            {regulatedDaily.length === 0 && (
                              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No hay datos de costes diarios.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Matriz de Periodos */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-200">Matriz de Costes Regulados</h3>
                        <select 
                          value={activeRegulatedYear} 
                          onChange={(e) => setActiveRegulatedYear(parseInt(e.target.value))}
                          style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                        >
                          {availableRegulatedYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto" style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <tr>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">Tarifa</th>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">F. Inicio</th>
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
                                <td colSpan={9} className="p-3 text-sm font-bold text-[var(--primary)] uppercase tracking-wider bg-gray-800/40">
                                  {concept}
                                </td>
                              </tr>
                              {(records as any[]).map((r: any) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-gray-800/30">
                                  <td className="p-3 text-sm text-gray-300">
                                    <span className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs">{r.tariff}</span>
                                  </td>
                                  <td className="p-3 text-sm text-gray-400 whitespace-nowrap">{new Date(r.validFrom).toLocaleDateString()}</td>
                                  {r.singleValue ? (
                                    <td colSpan={6} className="p-3 text-sm text-[var(--primary)] font-bold text-center">
                                      Fijo: {r.singleValue}
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
                                  <td className="p-3 text-right">
                                    <button onClick={() => deleteRegulated(r.id)} className="text-red-400 hover:text-red-300 p-1">
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                          {filteredRegulated.length === 0 && (
                            <tr><td colSpan={9} className="p-8 text-center text-gray-500">No hay datos de costes regulados para este año.</td></tr>
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
                            onChange={(e) => setActiveYear(parseInt(e.target.value))}
                            style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                          >
                            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <button 
                          onClick={saveFutures}
                          disabled={savingFutures}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--lime)', color: 'var(--bg-base)', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: savingFutures ? 'wait' : 'pointer' }}
                        >
                          {savingFutures ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Guardar Cambios
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {editedFutures.map(f => {
                          const mNum = f.month % 100;
                          return (
                          <div key={f.id} className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-elevated)] flex flex-col justify-between items-center relative group">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Mes {String(mNum).padStart(2, '0')}</span>
                          <input 
                            type="number"
                            value={f.price}
                            onChange={(e) => handleFutureChange(f.id, e.target.value)}
                            className="text-2xl font-black text-[var(--lime)] bg-transparent border-b border-dashed border-gray-600 focus:border-[var(--lime)] outline-none text-center w-full"
                            style={{ WebkitAppearance: 'none', margin: 0, MozAppearance: 'textfield' }}
                          />
                            <span className="text-xs text-gray-500 mt-1">€ / MWh</span>
                          </div>
                        )})}
                      </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
