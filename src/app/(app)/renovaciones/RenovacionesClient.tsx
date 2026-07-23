'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, RefreshCcw, Calendar, Zap, CheckCircle2, XCircle, AlertTriangle, MapPin, Phone, Mail, MoreHorizontal , ExternalLink} from 'lucide-react';
import PaginationFooter from '@/components/PaginationFooter';
import Link from 'next/link';
import RenovarModal from '@/components/renovaciones/RenovarModal';
import { useEffect } from 'react';
import { getPaginatedRenovacionesAction } from '@/app/actions/renovacionesActions';
import { useSession } from 'next-auth/react';

export interface RenovacionData {
  id: string;
  contractId: string;
  clientId: string;
  cups: string;
  direccion: string;
  cliente: string;
  telefonoContacto: string;
  emailContacto: string;
  emailComercial: string;
  fechaActivacion: string;
  tarifa: string;
  mwh: number;
  vencimiento: string;
  diasRestantes: number;
  producto: string;
  canal: string;
  estado: string; // 'URGENTE' | 'PROXIMO' | 'PENDIENTE'
  hasSelfConsumption: boolean;
  hasPendingRenewal?: boolean;
}

const estadoBadge = (estado: string, dias: number) => {
  if (estado === 'VENCIDO')  return <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}><XCircle size={10} /> Vencido ({Math.abs(dias)}d)</span>;
  if (estado === 'URGENTE')  return <span className="badge badge-danger"><AlertTriangle size={10} /> {dias} días</span>;
  if (estado === 'PROXIMO')  return <span className="badge badge-warning"><Calendar size={10} /> {dias} días</span>;
  return <span className="badge badge-draft">{dias} días</span>;
};

export default function RenovacionesClient({ initialRenovaciones, initialTotalCount, initialStats, products = [], canales = [], additionalServices = [] }: { initialRenovaciones: RenovacionData[], initialTotalCount: number, initialStats: any, products?: any[], canales?: any[], additionalServices?: any[] }) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'user';
  const showCanalFilter = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('URGENTE');
  const [tarifaFilter, setTarifaFilter] = useState('TODAS');
  const [canalFilter, setCanalFilter] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [renovados, setRenovados] = useState<string[]>([]);
  const [ocultos, setOcultos] = useState<string[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeModalRenovaciones, setActiveModalRenovaciones] = useState<RenovacionData[]>([]);
  
  const [renovarModalOpen, setRenovarModalOpen] = useState(false);
  const [selectedRenovacion, setSelectedRenovacion] = useState<RenovacionData | null>(null);

  const [renovaciones, setRenovaciones] = useState<RenovacionData[]>(initialRenovaciones);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isLoading, setIsLoading] = useState(false);

  // Las tarifas en el selector se pueden mantener hardcodeadas o cargarlas del catálogo
  const tarifasUnicas = ['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.2TD'];

  const isFirstRender = React.useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const fetchRenovaciones = async () => {
      setIsLoading(true);
      try {
        const result = await getPaginatedRenovacionesAction(page, itemsPerPage, search, tarifaFilter, estadoFilter, canalFilter);
        if (result.success && result.renovaciones) {
          setRenovaciones(result.renovaciones as RenovacionData[]);
          setTotalCount(result.totalCount || 0);
        }
      } catch (err) {
        console.error("Error fetching renovaciones:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceId = setTimeout(() => {
      fetchRenovaciones();
    }, 300);

    return () => clearTimeout(debounceId);
  }, [page, itemsPerPage, search, estadoFilter, tarifaFilter, canalFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, estadoFilter, tarifaFilter, canalFilter]);

  // Aplicar ocultación local
  const displayedRenovaciones = renovaciones.filter(r => !ocultos.includes(r.id));

  const allSelectable = displayedRenovaciones.filter(r => !r.hasPendingRenewal && !renovados.includes(r.id));
  const allSelected = allSelectable.length > 0 && selectedIds.length === allSelectable.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allSelectable.map(r => r.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleRenovarMasivamente = () => {
    const selected = renovaciones.filter(r => selectedIds.includes(r.id));
    setActiveModalRenovaciones(selected);
    setRenovarModalOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Renovaciones" subtitle="Contratos próximos a vencimiento · Gestión de retención de cartera" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            showCanalFilter ? { label: 'Contratos Vencidos', value: String(initialStats?.vencidos || 0), sub: '< 0 días', color: '#ef4444', icon: XCircle } : null,
            { label: 'Renovaciones Urgentes', value: String(initialStats?.urgentes || 0),  sub: '0–20 días',     color: 'var(--danger)',  icon: AlertTriangle },
            { label: 'Próximas (21–40 días)', value: String(initialStats?.proximos || 0),  sub: 'Planificar ya',  color: 'var(--warning)', icon: Calendar },
            { label: 'Total en Cola',         value: String(showCanalFilter ? (initialStats?.totalEnCola || 0) : ((initialStats?.totalEnCola || 0) - (initialStats?.vencidos || 0))), sub: 'pendientes', color: 'var(--lime)', icon: RefreshCcw },
            { label: 'MWh en Riesgo',         value: `${(initialStats?.totalMwhRenovar || 0).toFixed(0)}`, sub: 'MWh/año',    color: 'var(--info)',    icon: Zap },
          ].filter(Boolean).map((k: any, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={k.color} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>{k.sub}</div>
              </div>
            );
          })}
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                <CheckCircle2 size={18} />
              </div>
              <span className="text-amber-500 font-semibold">{selectedIds.length} contratos seleccionados</span>
            </div>
            <button 
              onClick={handleRenovarMasivamente}
              className="btn-primary"
              style={{ padding: '8px 24px', fontWeight: 'bold', fontSize: '0.9rem' }}
            >
              Renovar Masivamente ({selectedIds.length})
            </button>
          </div>
        )}

        {/* Filters & Table wrapper */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar cliente o CUPS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            
            <select className="form-input" value={tarifaFilter} onChange={e => { setTarifaFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value="TODAS">Todas las Tarifas</option>
              {tarifasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {showCanalFilter && (
              <select className="form-input" value={canalFilter} onChange={e => { setCanalFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
                <option value="TODOS">Todos los canales</option>
                {canales?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            <select className="form-input" value={estadoFilter} onChange={e => { setEstadoFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value="VENCIDO">Vencido (&lt; 0 días)</option>
              <option value="URGENTE">Urgente (0–20 días)</option>
              <option value="PROXIMO">Próximo (21–40d)</option>
              <option value="PENDIENTE">Pendiente (+40d)</option>
            </select>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {totalCount} contratos
            </div>
          </div>

          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {displayedRenovaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No hay contratos que venzan próximamente con los filtros actuales.
              </div>
            ) : (
              displayedRenovaciones.map((r) => {
                const renovado = r.hasPendingRenewal || renovados.includes(r.id);
                return (
                  <div key={r.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', opacity: renovado ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, paddingRight: '8px' }}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 mt-1 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleOne(r.id)}
                          disabled={renovado}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{r.cliente}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{r.telefonoContacto}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {renovado ? (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>✅ Renovado</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Vence en {r.diasRestantes}d</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--lime)', border: '1px solid var(--border)' }}>
                        {r.tarifa}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {r.canal} / {r.emailComercial?.split('@')[0]}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <strong>CUPS:</strong> {r.cups}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Vence: {new Date(r.vencimiento).toLocaleDateString('es-ES')}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => window.location.href = `/contratos/${r.id}`} className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}>
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Cliente / Contacto</th>
                  <th>Suministro</th>
                  <th>Contrato</th>
                  <th>Canal</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedRenovaciones.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      No hay contratos que venzan próximamente con los filtros actuales.
                    </td>
                  </tr>
                ) : displayedRenovaciones.map((r) => {
                  const renovado = r.hasPendingRenewal || renovados.includes(r.id);
                  return (
                    <tr key={r.id} style={{ opacity: renovado ? 0.5 : 1, transition: 'opacity 0.3s' }} className={selectedIds.includes(r.id) ? 'bg-amber-500/5' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleOne(r.id)}
                          disabled={renovado}
                        />
                      </td>
                      
                      {/* CLIENTE */}
                      <td>
                        <div className="font-bold text-white mb-2">{r.cliente}</div>
                        <div className="flex flex-col gap-1 text-xs text-slate-400">
                          <div className="flex items-center gap-2"><Phone size={12} className="text-slate-500"/> {r.telefonoContacto}</div>
                          <div className="flex items-center gap-2" title={`Comercial asignado: ${r.emailComercial}`}><Mail size={12} className="text-slate-500"/> {r.emailContacto}</div>
                        </div>
                      </td>

                      {/* SUMINISTRO */}
                      <td>
                        <div className="text-sm font-mono text-lime-400 font-bold mb-2">{r.cups}</div>
                        <div className="flex items-start gap-2 text-xs text-slate-400">
                          <MapPin size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                          <span className="whitespace-normal max-w-[200px]">{r.direccion}</span>
                        </div>
                      </td>

                      {/* CONTRATO */}
                      <td>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="badge badge-process">{r.tarifa}</span>
                          <span className="text-xs font-mono bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300">{r.mwh.toFixed(1)} MWh</span>
                        </div>
                        <div className="text-xs text-slate-400 flex flex-col gap-1">
                          <div><span className="text-slate-500">Producto:</span> <span className="text-amber-400 font-medium">{r.producto}</span></div>
                          <div><span className="text-slate-500">Activación:</span> {r.fechaActivacion}</div>
                          <div><span className="text-slate-500">Vencimiento:</span> <span className="text-white font-medium">{r.vencimiento}</span></div>
                        </div>
                      </td>

                      {/* CANAL */}
                      <td style={{ verticalAlign: 'top' }}>
                        <div className="mt-2 text-sm text-slate-300 font-medium">
                          {r.canal}
                        </div>
                      </td>

                      {/* ESTADO */}
                      <td style={{ textAlign: 'center', verticalAlign: 'top' }}>
                        <div className="mt-2">{estadoBadge(r.estado, r.diasRestantes)}</div>
                      </td>

                      {/* ACCIONES */}
                      <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                        {renovado ? (
                          <span className="badge badge-active inline-flex mt-2"><CheckCircle2 size={10} /> Renovado</span>
                        ) : (
                          <div className="flex items-center justify-end">
                            <button 
                              onClick={() => {
                                setActiveModalRenovaciones([r]);
                                setRenovarModalOpen(true);
                              }}
                              className="btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            >
                              Renovar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationFooter
            currentPage={page}
            itemsPerPage={itemsPerPage}
            totalItems={totalCount}
            itemName="renovaciones"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>

      <RenovarModal 
        isOpen={renovarModalOpen} 
        onClose={() => {
          setRenovarModalOpen(false);
          setActiveModalRenovaciones([]);
        }}
        renovaciones={activeModalRenovaciones}
        products={products}
        additionalServices={additionalServices}
        onRenovado={(id) => {
          setRenovados(p => [...p, id]);
          setSelectedIds(prev => prev.filter(selId => selId !== id)); // quitar de seleccionados si se renovó con éxito
        }}
        userRole={userRole}
      />
    </div>
  );
}
