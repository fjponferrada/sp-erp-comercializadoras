'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, Package, Tag, TrendingUp, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';

const mockProductos = [
  { id: 'PROD-001', nombre: 'AED Fijo 12 Meses',       tipo: 'FIJO',     tarifa: '2.0TD',  p1e: 0.1642, p2e: null,   p3e: null,   fee: null,  pexc: null,  permanencia: 12, activo: true },
  { id: 'PROD-002', nombre: 'AED Fijo 24 Meses',       tipo: 'FIJO',     tarifa: '3.0TD',  p1e: 0.1580, p2e: 0.1420, p3e: 0.1200, fee: null,  pexc: null,  permanencia: 24, activo: true },
  { id: 'PROD-003', nombre: 'AED Indexado BOE fee 20', tipo: 'INDEXADO', tarifa: '2.0TD',  p1e: null,   p2e: null,   p3e: null,   fee: 20.0,  pexc: null,  permanencia: 0,  activo: true },
  { id: 'PROD-004', nombre: 'AED Indexado BOE fee 15', tipo: 'INDEXADO', tarifa: '3.0TD',  p1e: null,   p2e: null,   p3e: null,   fee: 15.0,  pexc: null,  permanencia: 0,  activo: true },
  { id: 'PROD-005', nombre: 'AED Solar Indexado',      tipo: 'INDEXADO', tarifa: '2.0TD',  p1e: null,   p2e: null,   p3e: null,   fee: 18.0,  pexc: 0.06,  permanencia: 12, activo: true },
  { id: 'PROD-006', nombre: 'AED Pass-Through 6.1TD',  tipo: 'PASS',     tarifa: '6.1TD',  p1e: null,   p2e: null,   p3e: null,   fee: 12.0,  pexc: null,  permanencia: 12, activo: true },
  { id: 'PROD-007', nombre: 'AED Fijo Industrial',     tipo: 'FIJO',     tarifa: '6.1TD',  p1e: 0.1120, p2e: 0.0980, p3e: 0.0810, fee: null,  pexc: null,  permanencia: 24, activo: true },
  { id: 'PROD-008', nombre: 'AED Legacy 2022',         tipo: 'FIJO',     tarifa: '2.0TD',  p1e: 0.1850, p2e: null,   p3e: null,   fee: null,  pexc: null,  permanencia: 12, activo: false },
];

const tipoBadge = (tipo: string) => {
  if (tipo === 'FIJO')     return <span className="badge badge-process">Precio Fijo</span>;
  if (tipo === 'INDEXADO') return <span className="badge badge-lime">Indexado</span>;
  return <span className="badge badge-warning">Pass-Through</span>;
};

const PAGE_SIZE = 8;

export default function ProductosPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('TODOS');
  const [soloActivos, setSoloActivos] = useState(true);
  const [page, setPage] = useState(1);

  const filtered = mockProductos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.tarifa.includes(search.toUpperCase());
    const matchTipo = tipoFilter === 'TODOS' || p.tipo === tipoFilter;
    const matchActivo = !soloActivos || p.activo;
    return matchSearch && matchTipo && matchActivo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Topbar title="Productos" subtitle="Catálogo de tarifas y precios comercializables" action={{ label: 'Nuevo Producto', onClick: () => {} }} />

      <div style={{ padding: '24px' }}>

        {/* Resumen tipos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Productos Fijos',      value: mockProductos.filter(p => p.tipo === 'FIJO' && p.activo).length,     color: 'var(--info)',    icon: Package },
            { label: 'Productos Indexados',  value: mockProductos.filter(p => p.tipo === 'INDEXADO' && p.activo).length, color: 'var(--lime)',    icon: TrendingUp },
            { label: 'Pass-Through',         value: mockProductos.filter(p => p.tipo === 'PASS' && p.activo).length,     color: 'var(--warning)', icon: Tag },
            { label: 'Inactivos / Archivados', value: mockProductos.filter(p => !p.activo).length,                       color: 'var(--text-muted)', icon: Package },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
                  <Icon size={15} color={k.color} />
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{k.value}</div>
              </div>
            );
          })}
        </div>

        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Filtros */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar producto o tarifa..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            <select className="form-input" value={tipoFilter} onChange={e => { setTipoFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value="TODOS">Todos los tipos</option>
              <option value="FIJO">Precio Fijo</option>
              <option value="INDEXADO">Indexado</option>
              <option value="PASS">Pass-Through</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} style={{ accentColor: 'var(--lime)' }} />
              Solo activos
            </label>
          </div>

          {/* Tabla */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre Comercial</th>
                  <th>Tipo</th>
                  <th>Tarifa</th>
                  <th style={{ textAlign: 'right' }}>P1E (€/kWh)</th>
                  <th style={{ textAlign: 'right' }}>P2E (€/kWh)</th>
                  <th style={{ textAlign: 'right' }}>P3E (€/kWh)</th>
                  <th style={{ textAlign: 'right' }}>Fee (€/MWh)</th>
                  <th style={{ textAlign: 'right' }}>P. Exc (€/kWh)</th>
                  <th style={{ textAlign: 'center' }}>Permanencia</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'center' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
                  <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{p.id}</td>
                    <td className="primary-cell">{p.nombre}</td>
                    <td>{tipoBadge(p.tipo)}</td>
                    <td><span className="badge badge-process">{p.tarifa}</span></td>
                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--lime)' }}>{p.p1e !== null ? p.p1e.toFixed(4) : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{p.p2e !== null ? p.p2e.toFixed(4) : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{p.p3e !== null ? p.p3e.toFixed(4) : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--warning)' }}>{p.fee !== null ? p.fee.toFixed(2) : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{p.pexc !== null ? p.pexc.toFixed(4) : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'center' }}>{p.permanencia ? `${p.permanencia}m` : 'Sin perm.'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {p.activo
                        ? <span className="badge badge-active">Activo</span>
                        : <span className="badge badge-draft">Inactivo</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" style={{ padding: '5px 8px' }}><Edit2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--lime)' }}>{filtered.length}</strong> productos
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
