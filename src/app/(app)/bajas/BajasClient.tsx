'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import { Search, TrendingDown, Zap, ExternalLink, Calendar } from 'lucide-react';
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
}

import WinbackOfferModal from '@/components/bajas/WinbackOfferModal';
import { Phone, MessageCircle, Send } from 'lucide-react';

export default function BajasClient({ initialBajas, products = [] }: { initialBajas: BajaData[], products?: any[] }) {
  const [search, setSearch] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [offerModalData, setOfferModalData] = useState<BajaData | null>(null);

  const filtered = useMemo(() => {
    return initialBajas.filter(b => {
      const matchSearch = b.cliente.toLowerCase().includes(search.toLowerCase()) || b.cups.toLowerCase().includes(search.toLowerCase());
      const matchMotivo = motivoFilter === 'TODOS' || b.motivo === motivoFilter;
      return matchSearch && matchMotivo;
    });
  }, [initialBajas, search, motivoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalMwhPerdido = filtered.reduce((s, b) => s + b.mwh, 0);
  const avgDias = filtered.length ? Math.round(filtered.reduce((s, b) => s + b.diasVida, 0) / filtered.length) : 0;

  return (
    <>
      <Topbar title="Bajas" subtitle="Contratos cancelados · Histórico para recuperación de cartera" />

      <div style={{ padding: '24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Bajas Este Mes',    value: String(initialBajas.length), color: 'var(--danger)',  icon: TrendingDown },
            { label: 'MWh Perdidos',      value: `${totalMwhPerdido.toFixed(0)}`, color: 'var(--warning)', icon: Zap },
            { label: 'Vida Media Cliente',value: `${avgDias}d`,            color: 'var(--info)',    icon: Calendar },
            { label: 'Recuperables',      value: '0',                      color: 'var(--success)', icon: TrendingDown },
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

        {/* Desglose por motivo */}
        <div className="card animate-fade-in-up delay-200" style={{ marginBottom: '16px', padding: '16px 20px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bajas por motivo</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {motivos.map(m => {
              const count = initialBajas.filter(b => b.motivo === m).length;
              if (!count) return null;
              return (
                <button key={m} onClick={() => setMotivoFilter(motivoFilter === m ? 'TODOS' : m)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '99px',
                  border: motivoFilter === m ? '1px solid var(--lime)' : '1px solid var(--border)',
                  background: motivoFilter === m ? 'rgba(222,255,154,0.1)' : 'var(--bg-elevated)',
                  color: motivoFilter === m ? 'var(--lime)' : 'var(--text-secondary)',
                  fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <span>{m}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar cliente o CUPS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} bajas
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Cliente</th>
                  <th>Tarifa</th>
                  <th>Producto</th>
                  <th>Fecha Baja</th>
                  <th>Motivo</th>
                  <th style={{ textAlign: 'center' }}>Acciones de Recuperación</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      No se encontraron bajas con los filtros aplicados.
                    </td>
                  </tr>
                ) : paginated.map((b) => (
                  <tr key={b.cups} style={{ cursor: 'default' }}>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b.cups.slice(0, 20)}...</td>
                    <td className="primary-cell">
                      <div className="flex flex-col">
                        <span>{b.cliente}</span>
                        {b.telefono && <span className="text-xs text-gray-500 font-mono">{b.telefono}</span>}
                      </div>
                    </td>
                    <td><span className="badge badge-draft">{b.tarifa}</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{b.producto}</td>
                    <td className="mono-cell" style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{b.fechaBaja}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {b.motivo}
                      </span>
                    </td>
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
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
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
