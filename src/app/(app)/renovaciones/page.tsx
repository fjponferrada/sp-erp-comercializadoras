'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, RefreshCcw, Calendar, Zap, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const mockRenovaciones = [
  { cups: 'ES0031406580959001DW', cliente: 'Talleres Hernández S.L.',      tarifa: '6.1TD', mwh: 187.4, vencimiento: '2026-06-18', diasRestantes: 12, producto: 'AED Fijo 12m',       canal: 'Aguirreclima',  estado: 'URGENTE' },
  { cups: 'ES0021000000394649KL', cliente: 'Clínica Dental Puerta Sur',    tarifa: '3.0TD', mwh: 42.1,  vencimiento: '2026-06-24', diasRestantes: 18, producto: 'AED Indexado BOE',   canal: 'AEC Energías',  estado: 'URGENTE' },
  { cups: 'ES0031104781919001ZF', cliente: 'Hostelería MR 2020 S.L.',      tarifa: '2.0TD', mwh: 12.8,  vencimiento: '2026-07-01', diasRestantes: 25, producto: 'AED Solar Indexado', canal: 'Directo',       estado: 'PROXIMO' },
  { cups: 'ES0031300601649001VA', cliente: 'Supermercados LídaSur',        tarifa: '6.1TD', mwh: 542.0, vencimiento: '2026-07-05', diasRestantes: 29, producto: 'AED Fijo 24m',       canal: 'SP Asesoría',   estado: 'PROXIMO' },
  { cups: 'ES0022000007621842MN', cliente: 'Centro Deportivo Aquasur',     tarifa: '3.0TD', mwh: 98.7,  vencimiento: '2026-07-10', diasRestantes: 34, producto: 'AED Indexado BOE',   canal: 'Aguirreclima',  estado: 'PROXIMO' },
  { cups: 'ES0031502819247001PQ', cliente: 'Importaciones Mediterráneo SL',tarifa: '6.1TD', mwh: 54.8,  vencimiento: '2026-07-15', diasRestantes: 39, producto: 'AED Fijo 12m',       canal: 'AEC Energías',  estado: 'PENDIENTE' },
  { cups: 'ES0031200948361001RK', cliente: 'Farmacia Buen Remedio',        tarifa: '2.0TD', mwh: 8.4,   vencimiento: '2026-07-22', diasRestantes: 46, producto: 'AED Solar Indexado', canal: 'Directo',       estado: 'PENDIENTE' },
  { cups: 'ES0021000000512773LM', cliente: 'Autoescuela Nuevas Rutas',     tarifa: '3.0TD', mwh: 22.1,  vencimiento: '2026-07-28', diasRestantes: 52, producto: 'AED Indexado BOE',   canal: 'SP Asesoría',   estado: 'PENDIENTE' },
  { cups: 'ES0031710293847001WX', cliente: 'Residencia San Marcos',        tarifa: '6.1TD', mwh: 215.3, vencimiento: '2026-08-05', diasRestantes: 60, producto: 'AED Fijo 24m',       canal: 'Aguirreclima',  estado: 'PENDIENTE' },
  { cups: 'ES0022000009834521TU', cliente: 'Colegio Internacional Sur',    tarifa: '6.1TD', mwh: 310.8, vencimiento: '2026-08-12', diasRestantes: 67, producto: 'AED Fijo 12m',       canal: 'AEC Energías',  estado: 'PENDIENTE' },
];

const PAGE_SIZE = 8;

const estadoBadge = (estado: string, dias: number) => {
  if (estado === 'URGENTE')  return <span className="badge badge-danger"><AlertTriangle size={10} /> {dias} días</span>;
  if (estado === 'PROXIMO')  return <span className="badge badge-warning"><Calendar size={10} /> {dias} días</span>;
  return <span className="badge badge-draft">{dias} días</span>;
};

export default function RenovacionesPage() {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [renovados, setRenovados] = useState<string[]>([]);
  const [ocultos, setOcultos] = useState<string[]>([]);

  const filtered = mockRenovaciones.filter(r => {
    const matchSearch = r.cliente.toLowerCase().includes(search.toLowerCase()) ||
      r.cups.toLowerCase().includes(search.toLowerCase());
    const matchEstado = estadoFilter === 'TODOS' || r.estado === estadoFilter;
    const matchOculto = !ocultos.includes(r.cups);
    return matchSearch && matchEstado && matchOculto;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const urgentes = mockRenovaciones.filter(r => r.estado === 'URGENTE').length;
  const proximos = mockRenovaciones.filter(r => r.estado === 'PROXIMO').length;
  const totalMwhRenovar = filtered.reduce((s, r) => s + r.mwh, 0);

  return (
    <>
      <Topbar title="Renovaciones" subtitle="Contratos próximos a vencimiento · Gestión de retención de cartera" />

      <div style={{ padding: '24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Renovaciones Urgentes', value: String(urgentes),  sub: '< 20 días',     color: 'var(--danger)',  icon: AlertTriangle },
            { label: 'Próximas (20–40 días)', value: String(proximos),  sub: 'Planificar ya',  color: 'var(--warning)', icon: Calendar },
            { label: 'Total en Cola',         value: String(filtered.length), sub: 'pendientes', color: 'var(--lime)', icon: RefreshCcw },
            { label: 'MWh en Riesgo',         value: `${totalMwhRenovar.toFixed(0)}`, sub: 'MWh/año',    color: 'var(--info)',    icon: Zap },
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
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar cliente o CUPS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            <select className="form-input" value={estadoFilter} onChange={e => { setEstadoFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value="TODOS">Todos los estados</option>
              <option value="URGENTE">Urgente (&lt;20 días)</option>
              <option value="PROXIMO">Próximo (20–40d)</option>
              <option value="PENDIENTE">Pendiente (+40d)</option>
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} contratos
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Cliente</th>
                  <th>Tarifa</th>
                  <th>MWh/año</th>
                  <th>Producto Actual</th>
                  <th>Canal</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'center' }}>Días Rest.</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const renovado = renovados.includes(r.cups);
                  return (
                    <tr key={r.cups} style={{ opacity: renovado ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                      <td className="mono-cell" style={{ color: 'var(--lime)', fontSize: '0.75rem' }}>{r.cups.slice(0, 20)}...</td>
                      <td className="primary-cell">{r.cliente}</td>
                      <td><span className="badge badge-process">{r.tarifa}</span></td>
                      <td className="mono-cell">{r.mwh.toFixed(1)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.producto}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.canal}</td>
                      <td className="mono-cell" style={{ fontSize: '0.8rem' }}>{r.vencimiento}</td>
                      <td style={{ textAlign: 'center' }}>{estadoBadge(r.estado, r.diasRestantes)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {renovado ? (
                          <span className="badge badge-active"><CheckCircle2 size={10} /> Renovado</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="btn-primary" style={{ padding: '5px 12px', fontSize: '0.75rem' }} onClick={() => setRenovados(p => [...p, r.cups])}>
                              <RefreshCcw size={12} /> Renovar
                            </button>
                            <button className="btn-ghost" style={{ padding: '5px 8px' }} title="Ocultar" onClick={() => setOcultos(p => [...p, r.cups])}>
                              <XCircle size={12} />
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

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Mostrando <strong style={{ color: 'var(--text-primary)' }}>{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> de <strong style={{ color: 'var(--lime)' }}>{filtered.length}</strong>
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
