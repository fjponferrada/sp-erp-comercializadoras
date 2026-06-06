'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, TrendingDown, Zap, ChevronLeft, ChevronRight, ExternalLink, Calendar } from 'lucide-react';

const motivos = ['Cese de actividad', 'Cambio de comercializadora', 'Venta del inmueble', 'Impago', 'Solicitud cliente', 'Fin de permanencia'];

const mockBajas = [
  { cups: 'ES0031406580959001AB', cliente: 'Carpintería Artesanal Ruiz',    tarifa: '3.0TD', mwh: 28.4,  fechaAlta: '2024-03-10', fechaBaja: '2026-04-30', motivo: 'Cambio de comercializadora', canal: 'Aguirreclima', producto: 'AED Fijo 12m',       diasVida: 751 },
  { cups: 'ES0021000000394200KL', cliente: 'Bar Restaurante La Tasca',      tarifa: '2.0TD', mwh: 8.1,   fechaAlta: '2023-11-15', fechaBaja: '2026-05-02', motivo: 'Cese de actividad',          canal: 'Directo',      producto: 'AED Indexado BOE',   diasVida: 899 },
  { cups: 'ES0031104781000001ZF', cliente: 'Taller Mecánico Velocidad',     tarifa: '3.0TD', mwh: 19.2,  fechaAlta: '2024-06-01', fechaBaja: '2026-05-08', motivo: 'Impago',                     canal: 'AEC Energías', producto: 'AED Fijo 24m',       diasVida: 706 },
  { cups: 'ES0031300601000001VA', cliente: 'Clínica Veterinaria Animalvet', tarifa: '2.0TD', mwh: 6.5,   fechaAlta: '2024-01-20', fechaBaja: '2026-05-15', motivo: 'Solicitud cliente',           canal: 'SP Asesoría',  producto: 'AED Solar Indexado', diasVida: 846 },
  { cups: 'ES0022000007000001MN', cliente: 'Academia de Idiomas GlobalEd',  tarifa: '2.0TD', mwh: 11.8,  fechaAlta: '2024-09-05', fechaBaja: '2026-05-20', motivo: 'Cambio de comercializadora', canal: 'Directo',      producto: 'AED Indexado BOE',   diasVida: 622 },
  { cups: 'ES0031502819000001PQ', cliente: 'Papelería y Librería El Libro', tarifa: '2.0TD', mwh: 4.2,   fechaAlta: '2023-07-12', fechaBaja: '2026-05-25', motivo: 'Venta del inmueble',          canal: 'Aguirreclima', producto: 'AED Fijo 12m',       diasVida: 1048 },
  { cups: 'ES0031200948000001RK', cliente: 'Supermercado FrescaMar',        tarifa: '6.1TD', mwh: 122.7, fechaAlta: '2023-12-01', fechaBaja: '2026-05-28', motivo: 'Fin de permanencia',          canal: 'AEC Energías', producto: 'AED Fijo 24m',       diasVida: 909 },
  { cups: 'ES0021000000512000LM', cliente: 'Peluquería Corte & Arte',       tarifa: '2.0TD', mwh: 3.8,   fechaAlta: '2024-04-18', fechaBaja: '2026-05-31', motivo: 'Cese de actividad',          canal: 'Directo',      producto: 'AED Solar Indexado', diasVida: 773 },
];

const PAGE_SIZE = 8;

export default function BajasPage() {
  const [search, setSearch] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('TODOS');
  const [page, setPage] = useState(1);

  const filtered = mockBajas.filter(b => {
    const matchSearch = b.cliente.toLowerCase().includes(search.toLowerCase()) || b.cups.toLowerCase().includes(search.toLowerCase());
    const matchMotivo = motivoFilter === 'TODOS' || b.motivo === motivoFilter;
    return matchSearch && matchMotivo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalMwhPerdido = filtered.reduce((s, b) => s + b.mwh, 0);
  const avgDias = filtered.length ? Math.round(filtered.reduce((s, b) => s + b.diasVida, 0) / filtered.length) : 0;

  return (
    <>
      <Topbar title="Bajas" subtitle="Contratos cancelados · Histórico para recuperación de cartera" />

      <div style={{ padding: '24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Bajas Este Mes',    value: String(mockBajas.length), color: 'var(--danger)',  icon: TrendingDown },
            { label: 'MWh Perdidos',      value: `${totalMwhPerdido.toFixed(0)}`, color: 'var(--warning)', icon: Zap },
            { label: 'Vida Media Cliente',value: `${avgDias}d`,            color: 'var(--info)',    icon: Calendar },
            { label: 'Recuperables',      value: '5',                      color: 'var(--success)', icon: TrendingDown },
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
              const count = mockBajas.filter(b => b.motivo === m).length;
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
                  <th style={{ textAlign: 'right' }}>MWh/año</th>
                  <th>Producto</th>
                  <th>Canal</th>
                  <th>Fecha Alta</th>
                  <th>Fecha Baja</th>
                  <th>Vida (días)</th>
                  <th>Motivo</th>
                  <th style={{ textAlign: 'center' }}>Contrato</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((b) => (
                  <tr key={b.cups} style={{ cursor: 'pointer' }}>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b.cups.slice(0, 20)}...</td>
                    <td className="primary-cell">{b.cliente}</td>
                    <td><span className="badge badge-draft">{b.tarifa}</span></td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{b.mwh.toFixed(1)}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{b.producto}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.canal}</td>
                    <td className="mono-cell" style={{ fontSize: '0.78rem' }}>{b.fechaAlta}</td>
                    <td className="mono-cell" style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{b.fechaBaja}</td>
                    <td className="mono-cell" style={{ textAlign: 'center' }}>{b.diasVida}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {b.motivo}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" style={{ padding: '5px 8px' }}><ExternalLink size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Mostrando <strong style={{ color: 'var(--text-primary)' }}>{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> de <strong style={{ color: 'var(--lime)' }}>{filtered.length}</strong> bajas
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ width: '30px', height: '30px', borderRadius: '6px', border: p === page ? '1px solid var(--lime)' : '1px solid var(--border)', background: p === page ? 'rgba(222,255,154,0.12)' : 'transparent', color: p === page ? 'var(--lime)' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', cursor: 'pointer', fontWeight: p === page ? 700 : 400 }}>{p}</button>
              ))}
              <button className="btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 10px', opacity: page === totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
