'use client';

import { useState, useMemo, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { Search, TrendingDown, Zap, ExternalLink, Calendar , Mail} from 'lucide-react';
import PaginationFooter from '@/components/PaginationFooter';

const motivos = ['Cese de actividad', 'Cambio de comercializadora', 'Venta del inmueble', 'Impago', 'Solicitud cliente', 'Fin de permanencia'];

export interface BajaData {
  id: string; // Contract ID
  cups: string;
  cliente: string;
  clientId: string;
  telefono: string | null;
  email: string | null;
  tarifa: string;
  mwh: number;
  fechaAlta: string;
  fechaBaja: string;
  motivo: string;
  canal: string;
  producto: string;
  diasVida: number;
  hasSelfConsumption: boolean;
}

import WinbackOfferModal from '@/components/bajas/WinbackOfferModal';
import { Phone, MessageCircle, Send } from 'lucide-react';
import { getPaginatedBajasAction } from '@/app/actions/bajasActions';

const getTariffStyle = (tarifa: string) => {
  const t = tarifa.toUpperCase();
  if (t.includes('2.0')) return { background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' };
  if (t.includes('3.0')) return { background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' };
  if (t.includes('6.')) return { background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' };
  return { background: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.2)' };
};

export default function BajasClient({ initialBajas, initialTotalCount, initialStats, products = [], channels = [] }: { initialBajas: BajaData[], initialTotalCount: number, initialStats: any, products?: any[], channels?: any[] }) {
  const [search, setSearch] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('TODOS');
  const [canalFilter, setCanalFilter] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [offerModalData, setOfferModalData] = useState<BajaData | null>(null);

  const [bajas, setBajas] = useState<BajaData[]>(initialBajas);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (page === 1 && itemsPerPage === 100 && search === '' && motivoFilter === 'TODOS' && canalFilter === 'TODOS') return;

    const fetchBajas = async () => {
      setIsLoading(true);
      try {
        const result = await getPaginatedBajasAction(page, itemsPerPage, search, motivoFilter, canalFilter);
        if (result.success && result.bajas) {
          setBajas(result.bajas as BajaData[]);
          setTotalCount(result.totalCount || 0);
        }
      } catch (err) {
        console.error("Error fetching bajas:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceId = setTimeout(() => {
      fetchBajas();
    }, 300);

    return () => clearTimeout(debounceId);
  }, [page, itemsPerPage, search, motivoFilter, canalFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, motivoFilter, canalFilter]);

  return (
    <>
      <Topbar title="Bajas" subtitle="Contratos cancelados · Histórico para recuperación de cartera" />

      <div style={{ padding: '24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Bajas Este Mes',      value: String(initialStats?.bajasEsteMes || 0), color: 'var(--danger)',  icon: TrendingDown },
            { label: 'MWh Perdidos',        value: `${(initialStats?.totalMwhPerdido || 0).toFixed(0)}`, color: 'var(--warning)', icon: Zap },
            { label: 'Vida Media Contrato', value: `${initialStats?.avgDias || 0}d`, color: 'var(--info)',    icon: Calendar },
            { label: 'Vida Media Cliente',  value: `${initialStats?.avgClientDias || 0}d`, color: 'var(--success)', icon: Calendar },
          ].map((k, i) => {
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
              </div>
            );
          })}
        </div>



        {/* Table */}
        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar cliente o CUPS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            
            <select
              className="form-input"
              value={canalFilter}
              onChange={(e) => setCanalFilter(e.target.value)}
              style={{ width: '200px', fontSize: '0.8rem' }}
            >
              <option value="TODOS">Todos los canales</option>
              {channels?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {totalCount} bajas
            </div>
          </div>

          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {bajas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No se encontraron bajas con los filtros aplicados.
              </div>
            ) : (
              bajas.map((b, index) => (
                <div key={b.id || `${b.cups}-${index}`} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{b.cliente}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{b.telefono || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ ...getTariffStyle(b.tarifa), fontSize: '0.72rem' }}>{b.tarifa}</span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {b.producto}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Consumo:</strong> {b.mwh} MWh/año
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>CUPS:</strong> {b.cups}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600 }}>
                      Baja: {b.fechaBaja}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {b.telefono && (
                        <a href={`tel:${b.telefono}`} className="action-icon" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '6px', borderRadius: '6px' }} title="Llamar">
                          <Phone size={16} />
                        </a>
                      )}
                      {b.telefono && (
                        <a href={`https://wa.me/${b.telefono.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="action-icon" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '6px', borderRadius: '6px' }} title="WhatsApp">
                          <MessageCircle size={16} />
                        </a>
                      )}
                      {b.email && (
                        <a href={`mailto:${b.email}`} className="action-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '6px', borderRadius: '6px' }} title="Enviar Email">
                          <Mail size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Cliente</th>
                  <th>Tarifa</th>
                  <th>MWh/año</th>
                  <th>Producto</th>
                  <th>Fecha Baja</th>
                  <th style={{ textAlign: 'center' }}>Acciones de Recuperación</th>
                </tr>
              </thead>
              <tbody>
                {bajas.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      No se encontraron bajas con los filtros aplicados.
                    </td>
                  </tr>
                ) : bajas.map((b, index) => (
                  <tr key={b.id || `${b.cups}-${index}`} style={{ cursor: 'default' }}>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b.cups.slice(0, 20)}...</td>
                    <td className="primary-cell">
                      <div className="flex flex-col">
                        <span>{b.cliente}</span>
                        {b.telefono && <span className="text-xs text-gray-500 font-mono">{b.telefono}</span>}
                      </div>
                    </td>
                    <td><span className="badge" style={getTariffStyle(b.tarifa)}>{b.tarifa}</span></td>
                    <td><span className="mono-cell" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.mwh}</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{b.producto}</td>
                    <td className="mono-cell" style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{b.fechaBaja}</td>

                    <td>
                      <div className="flex items-center justify-center gap-2">
                        {b.telefono && (
                          <a href={`tel:${b.telefono}`} className="btn-ghost text-emerald-400 hover:text-emerald-300" style={{ padding: '6px' }} title="Llamar">
                            <Phone size={14} />
                          </a>
                        )}
                        {b.telefono && (
                          <a href={`https://wa.me/${b.telefono.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="btn-ghost text-green-400 hover:text-green-300" style={{ padding: '6px' }} title="WhatsApp">
                            <MessageCircle size={14} />
                          </a>
                        )}
                        <button onClick={() => setOfferModalData(b)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', gap: 4 }}>
                          <Send size={12} /> Recuperar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationFooter
            currentPage={page}
            itemsPerPage={itemsPerPage}
            totalItems={totalCount}
            itemName="bajas"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>
      
      {offerModalData && (
        <WinbackOfferModal 
          baja={offerModalData} 
          products={products}
          onClose={() => setOfferModalData(null)}
        />
      )}
    </>
  );
}
