'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, Download, Mail, TrendingUp, Receipt, Zap, BarChart3, Filter, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

const mockFacturas = [
  { numero: 'AED-2026-00248', cliente: 'Talleres Hernández S.L.',      cups: 'ES0031406580959001DW', fecha: '31/05/2026', tarifa: '6.1TD', mwh: 31.42,  bi: 8720.40, ie: 5.11, total: 9152.30, margen: 642.10 },
  { numero: 'AED-2026-00247', cliente: 'Supermercados LídaSur',         cups: 'ES0031300601649001VA', fecha: '31/05/2026', tarifa: '6.1TD', mwh: 88.70,  bi: 24610.00, ie: 5.11, total: 25820.10, margen: 1810.20 },
  { numero: 'AED-2026-00246', cliente: 'Clínica Dental Puerta Sur',     cups: 'ES0021000000394649KL', fecha: '30/05/2026', tarifa: '3.0TD', mwh: 12.18,  bi: 3380.20, ie: 5.11, total: 3549.30, margen: 248.40 },
  { numero: 'AED-2026-00245', cliente: 'Centro Deportivo Aquasur',      cups: 'ES0022000007621842MN', fecha: '30/05/2026', tarifa: '3.0TD', mwh: 18.54,  bi: 5150.80, ie: 5.11, total: 5407.50, margen: 376.20 },
  { numero: 'AED-2026-00244', cliente: 'Panadería Artesana El Horno',   cups: 'ES0031104781919001ZF', fecha: '29/05/2026', tarifa: '2.0TD', mwh: 3.21,   bi: 891.40,  ie: 5.11, total: 936.10,  margen: 64.80 },
  { numero: 'AED-2026-00243', cliente: 'Importaciones Mediterráneo SL', cups: 'ES0031502819247001PQ', fecha: '29/05/2026', tarifa: '6.1TD', mwh: 54.80,  bi: 15220.60, ie: 5.11, total: 15979.90, margen: 1118.40 },
  { numero: 'AED-2026-00242', cliente: 'Hostelería MR 2020 S.L.',       cups: 'ES0031200948361001RK', fecha: '28/05/2026', tarifa: '2.0TD', mwh: 2.88,   bi: 799.80,  ie: 5.11, total: 839.80,  margen: 58.30 },
  { numero: 'AED-2026-00241', cliente: 'Autoescuela Nuevas Rutas',      cups: 'ES0021000000512773LM', fecha: '28/05/2026', tarifa: '3.0TD', mwh: 5.60,   bi: 1554.40, ie: 5.11, total: 1631.40, margen: 112.80 },
  { numero: 'AED-2026-00240', cliente: 'Residencia San Marcos',         cups: 'ES0031710293847001WX', fecha: '27/05/2026', tarifa: '6.1TD', mwh: 72.30,  bi: 20083.30, ie: 5.11, total: 21081.90, margen: 1476.60 },
  { numero: 'AED-2026-00239', cliente: 'Peluquería Moderna Estilo',     cups: 'ES0022000009834521TU', fecha: '27/05/2026', tarifa: '2.0TD', mwh: 1.40,   bi: 388.60,  ie: 5.11, total: 408.10,  margen: 28.40 },
  { numero: 'AED-2026-00238', cliente: 'Imprenta Offset Color',         cups: 'ES0031406198273001CD', fecha: '26/05/2026', tarifa: '3.0TD', mwh: 8.92,   bi: 2477.60, ie: 5.11, total: 2601.30, margen: 181.00 },
  { numero: 'AED-2026-00237', cliente: 'Colegio San Lorenzo',           cups: 'ES0031105847293001EF', fecha: '26/05/2026', tarifa: '6.1TD', mwh: 44.10,  bi: 12243.80, ie: 5.11, total: 12851.80, margen: 897.20 },
];

const PAGE_SIZE = 10;

export default function FacturasPage() {
  const [search, setSearch] = useState('');
  const [mesFilter, setMesFilter] = useState('2026-05');
  const [page, setPage] = useState(1);

  const filtered = mockFacturas.filter(f =>
    f.numero.toLowerCase().includes(search.toLowerCase()) ||
    f.cliente.toLowerCase().includes(search.toLowerCase()) ||
    f.cups.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalMes    = filtered.reduce((s, f) => s + f.total, 0);
  const totalMwh    = filtered.reduce((s, f) => s + f.mwh, 0);
  const totalMargen = filtered.reduce((s, f) => s + f.margen, 0);
  const margenPct   = totalMes > 0 ? ((totalMargen / totalMes) * 100).toFixed(2) : '0.00';

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <Topbar
        title="Facturas"
        subtitle="Histórico de facturas emitidas a clientes"
        action={{ label: 'Importar CSV', onClick: () => {} }}
      />

      <div style={{ padding: '24px' }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Facturado Mes', value: `${fmt(totalMes)} €`,      icon: Receipt,    color: 'var(--info)' },
            { label: 'Total MWh Mes',       value: `${totalMwh.toFixed(2)} MWh`, icon: Zap,     color: 'var(--lime)' },
            { label: 'Margen Mes',          value: `${fmt(totalMargen)} €`,   icon: TrendingUp, color: 'var(--success)' },
            { label: 'Margen % Medio',      value: `${margenPct}%`,           icon: BarChart3,  color: 'var(--warning)' },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {kpi.label}
                  </p>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={kpi.color} />
                  </div>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {kpi.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Table Card */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Filters */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                placeholder="Buscar por nº factura, cliente o CUPS..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={13} color="var(--text-muted)" />
              <select className="form-input" value={mesFilter} onChange={e => setMesFilter(e.target.value)} style={{ width: 'auto', fontSize: '0.8rem' }}>
                {['2026-05','2026-04','2026-03','2026-02','2026-01'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              {filtered.length} facturas
            </div>
            <button className="btn-ghost" style={{ gap: '6px', fontSize: '0.78rem' }}>
              <Upload size={13} /> Exportar
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº Factura</th>
                  <th>Cliente</th>
                  <th>CUPS</th>
                  <th>Fecha</th>
                  <th>Tarifa</th>
                  <th style={{ textAlign: 'right' }}>MWh</th>
                  <th style={{ textAlign: 'right' }}>Base Imp. €</th>
                  <th style={{ textAlign: 'right' }}>IE %</th>
                  <th style={{ textAlign: 'right' }}>Total €</th>
                  <th style={{ textAlign: 'right' }}>Margen €</th>
                  <th style={{ textAlign: 'center' }}>PDF / Email</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((f) => (
                  <tr key={f.numero} style={{ cursor: 'pointer' }}>
                    <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 600 }}>{f.numero}</td>
                    <td className="primary-cell">{f.cliente}</td>
                    <td className="mono-cell" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.cups.slice(0, 20)}...</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.fecha}</td>
                    <td><span className="badge badge-process">{f.tarifa}</span></td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{f.mwh.toFixed(2)}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{fmt(f.bi)}</td>
                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{f.ie}%</td>
                    <td className="mono-cell" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(f.total)}</td>
                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{fmt(f.margen)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button className="btn-ghost" style={{ padding: '5px 8px' }} title="Descargar PDF"><Download size={13} /></button>
                        <button className="btn-ghost" style={{ padding: '5px 8px' }} title="Enviar email"><Mail size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Totales */}
                <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-strong)' }}>
                  <td colSpan={5} style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '12px 16px' }}>
                    TOTALES — {filtered.length} facturas
                  </td>
                  <td className="mono-cell" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{totalMwh.toFixed(2)}</td>
                  <td colSpan={2} />
                  <td className="mono-cell" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--lime)', fontSize: '0.9rem' }}>{fmt(totalMes)}</td>
                  <td className="mono-cell" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>{fmt(totalMargen)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Mostrando <strong style={{ color: 'var(--text-primary)' }}>{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> de <strong style={{ color: 'var(--lime)' }}>{filtered.length}</strong> facturas
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button className="btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{
                  width: '30px', height: '30px', borderRadius: '6px',
                  border: p === page ? '1px solid var(--lime)' : '1px solid var(--border)',
                  background: p === page ? 'rgba(222,255,154,0.12)' : 'transparent',
                  color: p === page ? 'var(--lime)' : 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', cursor: 'pointer',
                  fontWeight: p === page ? 700 : 400,
                }}>{p}</button>
              ))}
              <button className="btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 10px', opacity: page === totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
