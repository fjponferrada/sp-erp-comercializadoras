'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, Edit2, Loader2, Zap } from 'lucide-react';
import Topbar from '@/components/Topbar';

export default function ParametrosPricingPage() {
  const [activeTab, setActiveTab] = useState('regulados');
  const [loading, setLoading] = useState(true);
  
  const [regulated, setRegulated] = useState<any[]>([]);
  const [futures, setFutures] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resReg, resFut] = await Promise.all([
        fetch('/api/settings/regulated-costs'),
        fetch('/api/settings/future-prices')
      ]);
      setRegulated(await resReg.json());
      setFutures(await resFut.json());
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

  const deleteFuture = async (id: string) => {
    if (!confirm('¿Eliminar este registro de futuros?')) return;
    await fetch(`/api/settings/future-prices?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

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
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-200">Matriz de Costes Regulados</h3>
                    </div>
                    
                    <div className="overflow-x-auto" style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <tr>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">Concepto</th>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">Tarifa</th>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">F. Inicio</th>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">P1 a P6 (€/kWh)</th>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase">Fijo (€)</th>
                            <th className="p-3 text-xs text-gray-400 font-bold uppercase text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regulated.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-gray-800/30">
                              <td className="p-3 text-sm text-gray-200 font-medium">{r.concept}</td>
                              <td className="p-3 text-sm text-gray-300">
                                <span className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs">{r.tariff}</span>
                              </td>
                              <td className="p-3 text-sm text-gray-400">{new Date(r.validFrom).toLocaleDateString()}</td>
                              <td className="p-3 text-sm text-gray-300 font-mono">
                                {r.singleValue ? '-' : `${r.p1} / ${r.p2} / ...`}
                              </td>
                              <td className="p-3 text-sm text-[var(--primary)] font-bold">{r.singleValue ? r.singleValue : '-'}</td>
                              <td className="p-3 text-right">
                                <button onClick={() => deleteRegulated(r.id)} className="text-red-400 hover:text-red-300 p-1">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {regulated.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">No hay datos de costes regulados.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'futuros' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-200">Precios Objetivo Futuros (€/MWh)</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {futures.map(f => (
                        <div key={f.id} className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-elevated)] flex flex-col justify-between items-center relative group">
                          <button onClick={() => deleteFuture(f.id)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Mes {String(f.month).padStart(2, '0')}</span>
                          <span className="text-2xl font-black text-[var(--lime)]">{f.price}</span>
                          <span className="text-xs text-gray-500 mt-1">€ / MWh</span>
                        </div>
                      ))}
                      {futures.length === 0 && (
                        <div className="col-span-6 p-8 text-center text-gray-500">No hay precios futuros definidos.</div>
                      )}
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
