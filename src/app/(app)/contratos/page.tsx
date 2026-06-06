'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import {
  Zap,
  Loader2,
  TrendingDown,
  BarChart3,
  Search,
  ChevronDown,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileText,
} from 'lucide-react';

/* ─────────────────────────── TYPES ─────────────────────────── */
type Estado = 'ACTIVO' | 'BORRADOR' | 'TRAMITANDO' | 'BAJA' | 'RENOVACION';

interface Contrato {
  id: string;
  cups: string;
  cliente: string;
  estado: Estado;
  tarifa: string;
  consumoMwh: number;
  producto: string;
  canal: string;
  fechaAlta: string;
  fechaBaja: string | null;
}

/* ─────────────────────────── MOCK DATA ─────────────────────── */
const CONTRATOS: Contrato[] = [
  {
    id: 'CT-2024-00182',
    cups: 'ES0021000012345678ZF',
    cliente: 'Industrias Metálicas del Ebro S.L.',
    estado: 'ACTIVO',
    tarifa: '6.1TD',
    consumoMwh: 1248.5,
    producto: 'Fijo Plus Industrial',
    canal: 'Directo',
    fechaAlta: '2024-01-15',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00193',
    cups: 'ES0031000098765432AB',
    cliente: 'Grupo Hotelero Mediterráneo S.A.',
    estado: 'ACTIVO',
    tarifa: '3.0TD',
    consumoMwh: 892.3,
    producto: 'Indexado Mercado',
    canal: 'Agente',
    fechaAlta: '2024-02-01',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00201',
    cups: 'ES0041000054321098CD',
    cliente: 'Supermercados Familia Ruiz S.L.',
    estado: 'TRAMITANDO',
    tarifa: '3.0TD',
    consumoMwh: 445.7,
    producto: 'Fijo Anual Pyme',
    canal: 'Broker',
    fechaAlta: '2024-03-10',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00215',
    cups: 'ES0021000011223344EF',
    cliente: 'Clínica Dental Sonrisa Perfecta',
    estado: 'ACTIVO',
    tarifa: '2.0TD',
    consumoMwh: 38.2,
    producto: 'Pyme Estable 12M',
    canal: 'Online',
    fechaAlta: '2024-03-22',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00228',
    cups: 'ES0031000099887766GH',
    cliente: 'Transportes García e Hijos S.L.',
    estado: 'BORRADOR',
    tarifa: '3.0TD',
    consumoMwh: 0,
    producto: 'Indexado Premium',
    canal: 'Agente',
    fechaAlta: '2024-04-05',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00240',
    cups: 'ES0021000077665544IJ',
    cliente: 'Fábrica de Muebles Castilla S.A.',
    estado: 'BAJA',
    tarifa: '6.1TD',
    consumoMwh: 2103.8,
    producto: 'Gran Consumo Flex',
    canal: 'Directo',
    fechaAlta: '2023-07-01',
    fechaBaja: '2024-05-31',
  },
  {
    id: 'CT-2024-00254',
    cups: 'ES0041000033221100KL',
    cliente: 'Centro Comercial Torre Norte S.A.',
    estado: 'RENOVACION',
    tarifa: '3.0TD',
    consumoMwh: 1567.9,
    producto: 'Fijo Plus Industrial',
    canal: 'Directo',
    fechaAlta: '2023-06-15',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00261',
    cups: 'ES0021000055443322MN',
    cliente: 'Panadería Artesana La Espiga',
    estado: 'ACTIVO',
    tarifa: '2.0TD',
    consumoMwh: 22.1,
    producto: 'Pyme Estable 12M',
    canal: 'Online',
    fechaAlta: '2024-04-18',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00275',
    cups: 'ES0031000044332211OP',
    cliente: 'Automoción Valencia Norte S.L.',
    estado: 'TRAMITANDO',
    tarifa: '3.0TD',
    consumoMwh: 0,
    producto: 'Indexado Mercado',
    canal: 'Broker',
    fechaAlta: '2024-05-02',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00283',
    cups: 'ES0021000022334455QR',
    cliente: 'Restaurante El Rincón Asturiano',
    estado: 'ACTIVO',
    tarifa: '2.0TD',
    consumoMwh: 18.6,
    producto: 'Pyme Estable 12M',
    canal: 'Agente',
    fechaAlta: '2024-05-15',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00299',
    cups: 'ES0031000088776655ST',
    cliente: 'Farmacéutica Biomed S.A.',
    estado: 'ACTIVO',
    tarifa: '3.0TD',
    consumoMwh: 654.4,
    producto: 'Fijo Anual Pyme',
    canal: 'Directo',
    fechaAlta: '2024-05-28',
    fechaBaja: null,
  },
  {
    id: 'CT-2024-00310',
    cups: 'ES0041000066554433UV',
    cliente: 'Textiles del Norte S.L.',
    estado: 'BORRADOR',
    tarifa: '6.1TD',
    consumoMwh: 0,
    producto: 'Gran Consumo Flex',
    canal: 'Broker',
    fechaAlta: '2024-06-01',
    fechaBaja: null,
  },
];

/* ─────────────────────────── HELPERS ───────────────────────── */
const ESTADO_CONFIG: Record<Estado, { label: string; badge: string }> = {
  ACTIVO:     { label: 'Activo',      badge: 'badge badge-active'   },
  BORRADOR:   { label: 'Borrador',    badge: 'badge badge-draft'    },
  TRAMITANDO: { label: 'Tramitando',  badge: 'badge badge-process'  },
  BAJA:       { label: 'Baja',        badge: 'badge badge-danger'   },
  RENOVACION: { label: 'Renovación',  badge: 'badge badge-warning'  },
};

function truncateCups(cups: string) {
  return cups.length > 16 ? cups.slice(0, 8) + '…' + cups.slice(-6) : cups;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatMwh(v: number) {
  if (v === 0) return '—';
  return v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh';
}

/* ─────────────────────────── STAT CARDS ────────────────────── */
const STATS = [
  {
    label: 'Contratos Activos',
    value: '198',
    delta: '+12 este mes',
    positive: true,
    icon: Zap,
    color: 'var(--success)',
    glow: 'rgba(34,197,94,0.12)',
  },
  {
    label: 'En Tramitación',
    value: '29',
    delta: '+5 pendientes',
    positive: null,
    icon: Loader2,
    color: 'var(--info)',
    glow: 'rgba(59,130,246,0.12)',
  },
  {
    label: 'Bajas este mes',
    value: '7',
    delta: '−3 vs mes anterior',
    positive: true,
    icon: TrendingDown,
    color: 'var(--danger)',
    glow: 'rgba(239,68,68,0.10)',
  },
  {
    label: 'MWh Totales',
    value: '14.283',
    delta: '+8,4% vs año anterior',
    positive: true,
    icon: BarChart3,
    color: 'var(--lime)',
    glow: 'var(--lime-glow)',
  },
];

const TARIFAS = ['Todas', '2.0TD', '3.0TD', '6.1TD'];
const CANALES = ['Todos', 'Directo', 'Agente', 'Broker', 'Online'];
const ESTADOS_FILTER = ['Todos', 'ACTIVO', 'BORRADOR', 'TRAMITANDO', 'BAJA', 'RENOVACION'];

/* ─────────────────────────── PAGE ──────────────────────────── */
export default function ContratosPage() {
  const [search, setSearch]         = useState('');
  const [estadoFilter, setEstado]   = useState('Todos');
  const [tarifaFilter, setTarifa]   = useState('Todas');
  const [canalFilter, setCanal]     = useState('Todos');
  const [selectedRow, setSelected]  = useState<string | null>(null);
  const [sortCol, setSortCol]       = useState<keyof Contrato | null>(null);
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc');
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    let rows = CONTRATOS.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.cups.toLowerCase().includes(q) ||
        c.cliente.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.producto.toLowerCase().includes(q);
      const matchEstado = estadoFilter === 'Todos' || c.estado === estadoFilter;
      const matchTarifa = tarifaFilter === 'Todas' || c.tarifa === tarifaFilter;
      const matchCanal  = canalFilter  === 'Todos' || c.canal  === canalFilter;
      return matchSearch && matchEstado && matchTarifa && matchCanal;
    });

    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const va = a[sortCol] ?? '';
        const vb = b[sortCol] ?? '';
        const cmp = String(va).localeCompare(String(vb), 'es', { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [search, estadoFilter, tarifaFilter, canalFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(247 / PAGE_SIZE);
  const paginated  = filtered; // show all mock data; real pagination would slice

  function handleSort(col: keyof Contrato) {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Contratos"
        subtitle="Gestión de contratos de suministro eléctrico"
        action={{ label: 'Nuevo Contrato', onClick: () => alert('Nuevo contrato') }}
      />

      <div style={{ padding: '28px 28px 48px' }}>

        {/* ── STAT CARDS ── */}
        <div
          className="animate-fade-in-up"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}
        >
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {s.label}
                  </span>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    background: s.glow, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${s.glow}`,
                  }}>
                    <Icon size={16} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.74rem', color: s.positive === true ? 'var(--success)' : s.positive === false ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 500 }}>
                  {s.delta}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── TABLE CARD ── */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0 }}>

          {/* ── FILTER BAR ── */}
          <div style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="form-input"
                placeholder="Buscar CUPS, cliente, contrato, producto…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            {/* Estado */}
            <div style={{ position: 'relative', minWidth: '160px' }}>
              <select
                className="form-input"
                value={estadoFilter}
                onChange={e => { setEstado(e.target.value); setPage(1); }}
                style={{ paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
              >
                {ESTADOS_FILTER.map(e => (
                  <option key={e} value={e}>{e === 'Todos' ? 'Estado: Todos' : ESTADO_CONFIG[e as Estado]?.label ?? e}</option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>

            {/* Tarifa */}
            <div style={{ position: 'relative', minWidth: '140px' }}>
              <select
                className="form-input"
                value={tarifaFilter}
                onChange={e => { setTarifa(e.target.value); setPage(1); }}
                style={{ paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
              >
                {TARIFAS.map(t => (
                  <option key={t} value={t}>{t === 'Todas' ? 'Tarifa: Todas' : t}</option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>

            {/* Canal */}
            <div style={{ position: 'relative', minWidth: '140px' }}>
              <select
                className="form-input"
                value={canalFilter}
                onChange={e => { setCanal(e.target.value); setPage(1); }}
                style={{ paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}
              >
                {CANALES.map(c => (
                  <option key={c} value={c}>{c === 'Todos' ? 'Canal: Todos' : c}</option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>

            {/* Results count */}
            <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--lime)', fontWeight: 600 }}>{filtered.length}</span> de 247 contratos
            </div>
          </div>

          {/* ── TABLE ── */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    { key: 'cups',       label: 'CUPS'         },
                    { key: 'cliente',    label: 'Cliente'      },
                    { key: 'estado',     label: 'Estado'       },
                    { key: 'tarifa',     label: 'Tarifa'       },
                    { key: 'consumoMwh', label: 'Consumo'      },
                    { key: 'producto',   label: 'Producto'     },
                    { key: 'canal',      label: 'Canal'        },
                    { key: 'fechaAlta',  label: 'Fecha Alta'   },
                    { key: 'fechaBaja',  label: 'Fecha Baja'   },
                    { key: null,         label: 'Acciones'     },
                  ].map((col) => (
                    <th
                      key={col.label}
                      onClick={col.key ? () => handleSort(col.key as keyof Contrato) : undefined}
                      style={{
                        cursor: col.key ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {col.label}
                        {col.key && (
                          <ArrowUpDown
                            size={11}
                            style={{ color: sortCol === col.key ? 'var(--lime)' : 'var(--text-muted)', opacity: sortCol === col.key ? 1 : 0.5 }}
                          />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      <FileText size={32} style={{ marginBottom: '8px', opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                      No se encontraron contratos con los filtros aplicados.
                    </td>
                  </tr>
                ) : paginated.map((c) => {
                  const est = ESTADO_CONFIG[c.estado];
                  const isSelected = selectedRow === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(isSelected ? null : c.id)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(222,255,154,0.05)' : undefined,
                        outline: isSelected ? '1px solid rgba(222,255,154,0.18)' : undefined,
                        outlineOffset: '-1px',
                        transition: 'background 0.15s ease, outline 0.15s ease',
                      }}
                    >
                      {/* CUPS */}
                      <td className="mono-cell" title={c.cups}>
                        <span style={{ color: 'var(--lime)', fontWeight: 500, letterSpacing: '0.02em' }}>
                          {truncateCups(c.cups)}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="primary-cell" style={{ maxWidth: '220px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.cliente}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {c.id}
                        </div>
                      </td>

                      {/* Estado */}
                      <td>
                        <span className={est.badge}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                          {est.label}
                        </span>
                      </td>

                      {/* Tarifa */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '5px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-strong)',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          letterSpacing: '0.04em',
                        }}>
                          {c.tarifa}
                        </span>
                      </td>

                      {/* Consumo MWh */}
                      <td className="mono-cell" style={{ textAlign: 'right', paddingRight: '24px' }}>
                        <span style={{ color: c.consumoMwh > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {formatMwh(c.consumoMwh)}
                        </span>
                      </td>

                      {/* Producto */}
                      <td style={{ maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.producto}
                      </td>

                      {/* Canal */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 9px',
                          borderRadius: '99px',
                          background: 'var(--bg-elevated)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {c.canal}
                        </span>
                      </td>

                      {/* Fecha Alta */}
                      <td className="mono-cell" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(c.fechaAlta)}
                      </td>

                      {/* Fecha Baja */}
                      <td className="mono-cell" style={{ whiteSpace: 'nowrap' }}>
                        {c.fechaBaja ? (
                          <span style={{ color: 'var(--danger)' }}>{formatDate(c.fechaBaja)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-ghost"
                            style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            title="Ver contrato"
                          >
                            <Eye size={13} />
                            Ver
                          </button>
                          <button
                            className="btn-ghost"
                            style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            title="Editar contrato"
                          >
                            <Pencil size={13} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION FOOTER ── */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mostrando{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, 247)}
              </span>{' '}
              de{' '}
              <span style={{ color: 'var(--lime)', fontWeight: 700 }}>247</span>{' '}
              contratos
            </span>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                className="btn-ghost"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '5px 10px', borderRadius: '6px', opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i;
                } else {
                  p = page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '6px',
                      border: '1px solid',
                      borderColor: page === p ? 'var(--lime)' : 'var(--border)',
                      background: page === p ? 'var(--lime)' : 'var(--bg-elevated)',
                      color: page === p ? 'var(--bg-base)' : 'var(--text-secondary)',
                      fontWeight: page === p ? 700 : 400,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                className="btn-ghost"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: '5px 10px', borderRadius: '6px', opacity: page === totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Página <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{page}</span> de{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalPages}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
