'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Share2, Plus, Edit2, Trash2, Shield, Settings2, Percent, Calculator, Copy } from 'lucide-react';
import TierModal from './TierModal';
import RuleModal from './RuleModal';

interface CommissionRule {
  id: string;
  tierId: string;
  tariff: string | null;
  productType: string | null;
  products: { id: string }[];
  additionalServices: { id: string }[];
  powerMin: number | null;
  powerMax: number | null;
  commissionType: string;
  value: number;
}

interface CommissionTier {
  id: string;
  name: string;
  description: string | null;
  rules: CommissionRule[];
  channels: { id: string; name: string }[];
}

interface ProductInfo {
  id: string;
  name: string;
  type: string | null;
  tariff: string | null;
}

interface Props {
  initialTiers: CommissionTier[];
  products: ProductInfo[];
  services: { id: string; name: string }[];
}

export default function ComisionesClient({ initialTiers, products, services }: Props) {
  const [tiers, setTiers] = useState(initialTiers);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [selectedTierIdForRule, setSelectedTierIdForRule] = useState<string | null>(null);

  const refreshData = async () => {
    const res = await fetch('/api/commission-tiers');
    if (res.ok) {
      const data = await res.json();
      setTiers(data);
    }
  };

  const handleNewTier = () => {
    setEditingTier(null);
    setIsTierModalOpen(true);
  };

  const handleEditTier = (tier: CommissionTier) => {
    setEditingTier(tier);
    setIsTierModalOpen(true);
  };

  const handleNewRule = (tierId: string) => {
    setSelectedTierIdForRule(tierId);
    setEditingRule(null);
    setIsRuleModalOpen(true);
  };

  const handleEditRule = (tierId: string, rule: CommissionRule) => {
    setSelectedTierIdForRule(tierId);
    setEditingRule(rule);
    setIsRuleModalOpen(true);
  };

  const handleDuplicateRule = (tierId: string, rule: CommissionRule) => {
    setSelectedTierIdForRule(tierId);
    setEditingRule({ ...rule, id: '' });
    setIsRuleModalOpen(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta regla?')) return;
    try {
      await fetch(`/api/commission-rules/${id}`, { method: 'DELETE' });
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Topbar title="Niveles de Comisión" subtitle="Configura la matriz de comisiones para los canales" action={{ label: 'Nuevo Nivel', onClick: handleNewTier }} />

      <div style={{ padding: '24px' }} className="space-y-6">
        {tiers.map((tier) => (
          <div key={tier.id} className="card bg-slate-900 border border-slate-800 shadow-xl overflow-hidden animate-fade-in-up">
            {/* Header Nivel */}
            <div className="flex items-center justify-between p-5 bg-slate-800/50 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center">
                  <Shield size={20} className="text-lime-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                  <p className="text-xs text-slate-400">{tier.description || 'Sin descripción'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-slate-300 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 flex items-center gap-1.5">
                  <Share2 size={12} className="text-slate-400" /> {tier.channels.length} canales asignados
                </div>
                <button onClick={() => handleEditTier(tier)} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleNewRule(tier.id)} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-1.5">
                  <Plus size={14} /> Nueva Regla
                </button>
              </div>
            </div>

            {/* Rules */}
            <div className="p-0">
              {tier.rules.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      <th className="px-5 py-3">Tarifa / Producto</th>
                      <th className="px-5 py-3">Tramo Potencia</th>
                      <th className="px-5 py-3">Tipo de Comisión</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                      <th className="px-5 py-3 w-20 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {tier.rules.map(rule => (
                      <tr key={rule.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-3 text-sm text-slate-200">
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{rule.tariff || 'Cualquier Tarifa'}</span>
                            {rule.products && rule.products.length > 0 ? (
                              <div className="flex flex-col gap-1.5 mt-1.5">
                                <span className="text-[10px] uppercase tracking-wide font-bold text-indigo-400">
                                  Regla Específica ({rule.products.length} {rule.products.length === 1 ? 'producto' : 'productos'})
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {rule.products.map(rp => {
                                    const prod = products.find(p => p.id === rp.id);
                                    return prod ? (
                                      <span key={prod.id} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                        {prod.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            ) : rule.additionalServices && rule.additionalServices.length > 0 ? (
                              <div className="flex flex-col gap-1.5 mt-1.5">
                                <span className="text-[10px] uppercase tracking-wide font-bold text-emerald-400">
                                  Servicios Adicionales ({rule.additionalServices.length})
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {rule.additionalServices.map(rs => {
                                    const s = services?.find(srv => srv.id === rs.id);
                                    return s ? (
                                      <span key={s.id} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                        {s.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 mt-0.5">{rule.productType || 'Cualquier Producto'}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-300 font-mono text-xs">
                          {rule.powerMin !== null && rule.powerMax !== null ? `${rule.powerMin} - ${rule.powerMax} kW` : 
                           rule.powerMin !== null ? `> ${rule.powerMin} kW` : 
                           rule.powerMax !== null ? `< ${rule.powerMax} kW` : 'Cualquiera'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${rule.commissionType === 'PERCENTAGE' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-lime-500/10 text-lime-500 border border-lime-500/20'}`}>
                            {rule.commissionType === 'PERCENTAGE' ? '% sobre Margen' : 'Fijo (€)'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-white font-mono">
                          {rule.commissionType === 'PERCENTAGE' ? `${rule.value}%` : `${rule.value}€`}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditRule(tier.id, rule)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700" title="Editar">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDuplicateRule(tier.id, rule)} className="p-1.5 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-colors border border-indigo-500/20" title="Duplicar">
                              <Copy size={12} />
                            </button>
                            <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors border border-red-500/20" title="Eliminar">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No hay reglas de comisión configuradas en este nivel.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isTierModalOpen && (
        <TierModal
          tier={editingTier}
          onClose={() => setIsTierModalOpen(false)}
          onSaved={() => {
            setIsTierModalOpen(false);
            refreshData();
          }}
        />
      )}

      {isRuleModalOpen && (
        <RuleModal
          rule={editingRule}
          tierId={selectedTierIdForRule!}
          products={products}
          services={services}
          onClose={() => setIsRuleModalOpen(false)}
          onSaved={() => {
            setIsRuleModalOpen(false);
            refreshData();
          }}
        />
      )}
    </>
  );
}
