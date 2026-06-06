'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, Share2, Users, TrendingUp, Edit2, ChevronLeft, ChevronRight, Phone, Mail } from 'lucide-react';

const mockCanales = [
  { id: 'CAN-001', nombre: 'Aguirreclima',          contacto: 'José Aguirre',    telefono: '612 345 678', email: 'j.aguirre@aguirreclima.com',    codigo: 'AGU',  contratos: 48, activos: 41, comisionFijo: 3.50, comisionVariable: 15.0, estado: 'ACTIVO' },
  { id: 'CAN-002', nombre: 'AEC Energías',           contacto: 'María López',     telefono: '634 987 654', email: 'maria@aecenergias.com',          codigo: 'AEC',  contratos: 32, activos: 29, comisionFijo: 4.00, comisionVariable: 12.0, estado: 'ACTIVO' },
  { id: 'CAN-003', nombre: 'SP Asesoría Energética', contacto: 'Admin SP',        telefono: '900 123 456', email: 'admin@spenergia.com',            codigo: 'SPA',  contratos: 87, activos: 80, comisionFijo: 2.00, comisionVariable: 8.0,  estado: 'ACTIVO' },
  { id: 'CAN-004', nombre: 'GreenSales Partners',    contacto: 'Carlos Fuentes',  telefono: '678 234 567', email: 'carlos@greensales.es',           codigo: 'GRN',  contratos: 21, activos: 18, comisionFijo: 3.00, comisionVariable: 10.0, estado: 'ACTIVO' },
  { id: 'CAN-005', nombre: 'EnerProfit SL',          contacto: 'Ana Martínez',    telefono: '655 876 543', email: 'ana.martinez@enprofit.com',      codigo: 'ENP',  contratos: 15, activos: 12, comisionFijo: 4.50, comisionVariable: 18.0, estado: 'ACTIVO' },
  { id: 'CAN-006', nombre: 'Electricidad Ruiz',      contacto: 'Pedro Ruiz',      telefono: '691 345 678', email: 'p.ruiz@electricidadruiz.com',   codigo: 'ERZ',  contratos: 9,  activos: 7,  comisionFijo: 3.00, comisionVariable: 12.0, estado: 'ACTIVO' },
  { id: 'CAN-007', nombre: 'Canal Directo Web',      contacto: '—',               telefono: '—',           email: 'leads@aedenergia.com',          codigo: 'DIR',  contratos: 35, activos: 30, comisionFijo: 0.00, comisionVariable: 0.0,  estado: 'ACTIVO' },
  { id: 'CAN-008', nombre: 'Iberian Energy Partners',contacto: 'Rafael Soler',    telefono: '622 123 456', email: 'r.soler@iberianenergy.com',      codigo: 'IBP',  contratos: 4,  activos: 2,  comisionFijo: 5.00, comisionVariable: 20.0, estado: 'INACTIVO' },
];

const PAGE_SIZE = 8;

export default function CanalesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = mockCanales.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.contacto.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalContratos = mockCanales.reduce((s, c) => s + c.activos, 0);
  const totalCanales   = mockCanales.filter(c => c.estado === 'ACTIVO').length;
  const topCanal       = [...mockCanales].sort((a, b) => b.activos - a.activos)[0];

  return (
    <>
      <Topbar title="Canales" subtitle="Red de agentes comerciales y colaboradores" action={{ label: 'Nuevo Canal', onClick: () => {} }} />

      <div style={{ padding: '24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Canales Activos',     value: String(totalCanales),          color: 'var(--lime)',    icon: Share2 },
            { label: 'Contratos via Canal', value: String(totalContratos),        color: 'var(--success)', icon: TrendingUp },
            { label: 'Canal Top',           value: topCanal.codigo,               color: 'var(--warning)', icon: Users },
            { label: 'Contratos Top Canal', value: String(topCanal.activos),      color: 'var(--info)',    icon: TrendingUp },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
                  <Icon size={15} color={k.color} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{k.value}</div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar canal, contacto o código..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} canales
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre Canal</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Contratos</th>
                  <th style={{ textAlign: 'right' }}>Activos</th>
                  <th style={{ textAlign: 'right' }}>Com. Fijo (€)</th>
                  <th style={{ textAlign: 'right' }}>Com. Var. (%)</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'center' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }}>
                    <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 700 }}>{c.codigo}</td>
                    <td className="primary-cell">{c.nombre}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.contacto}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {c.telefono !== '—' && (
                        <a href={`tel:${c.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          <Phone size={11} /> {c.telefono}
                        </a>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {c.email !== '—' && (
                        <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          <Mail size={11} /> {c.email}
                        </a>
                      )}
                    </td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{c.contratos}</td>
                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--lime)', fontWeight: 600 }}>{c.activos}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{c.comisionFijo > 0 ? `${c.comisionFijo.toFixed(2)} €` : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{c.comisionVariable > 0 ? `${c.comisionVariable.toFixed(1)}%` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {c.estado === 'ACTIVO'
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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><strong style={{ color: 'var(--lime)' }}>{filtered.length}</strong> canales</span>
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
