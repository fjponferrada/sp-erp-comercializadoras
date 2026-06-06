'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import {
  Search,
  Filter,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  FilePen,
  Send,
  BadgeCheck,
  Zap,
  TrendingUp,
  MoreHorizontal,
  Download,
  RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadStatus = 'NUEVO' | 'BORRADOR GENERADO' | 'ENVIADO A FIRMA' | 'FIRMADO';
type Canal = 'Directo' | 'Agente' | 'Telemarketing' | 'Partner' | 'Online';
type Tarifa = '2.0TD' | '3.0TD' | '6.1TD' | '6.2TD' | '6.3TD' | '6.4TD';

interface Lead {
  id: string;
  titular: string;
  empresa?: string;
  nif: string;
  cups: string;
  tarifa: Tarifa;
  status: LeadStatus;
  canal: Canal;
  comercial: string;
  fechaRegistro: string;
  comisionEst: number;
  sipsOk: boolean;
  potencia: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const LEADS_DATA: Lead[] = [
  {
    id: 'LD-2026-0041',
    titular: 'Construcciones Delgado S.L.',
    empresa: 'CONSDEL',
    nif: 'B82341567',
    cups: 'ES0031405789472001JH0F',
    tarifa: '3.0TD',
    status: 'ENVIADO A FIRMA',
    canal: 'Agente',
    comercial: 'Raúl Moreno',
    fechaRegistro: '2026-06-01',
    comisionEst: 1240.0,
    sipsOk: true,
    potencia: '50 kW',
  },
  {
    id: 'LD-2026-0040',
    titular: 'María José Fernández López',
    nif: '48921034K',
    cups: 'ES0021000012345678AA0F',
    tarifa: '2.0TD',
    status: 'NUEVO',
    canal: 'Online',
    comercial: 'Ana García',
    fechaRegistro: '2026-06-02',
    comisionEst: 180.5,
    sipsOk: true,
    potencia: '5.75 kW',
  },
  {
    id: 'LD-2026-0039',
    titular: 'Hoteles Mediterráneo Group S.A.',
    empresa: 'HOTMED',
    nif: 'A78234512',
    cups: 'ES0031402398471003JR1F',
    tarifa: '6.1TD',
    status: 'FIRMADO',
    canal: 'Partner',
    comercial: 'Carlos Sanz',
    fechaRegistro: '2026-05-28',
    comisionEst: 8750.0,
    sipsOk: true,
    potencia: '400 kW',
  },
  {
    id: 'LD-2026-0038',
    titular: 'Logística Peninsular S.L.',
    empresa: 'LOGPEN',
    nif: 'B45123678',
    cups: 'ES0031400987654321XA0F',
    tarifa: '6.2TD',
    status: 'BORRADOR GENERADO',
    canal: 'Directo',
    comercial: 'Laura Jiménez',
    fechaRegistro: '2026-05-30',
    comisionEst: 3200.0,
    sipsOk: false,
    potencia: '150 kW',
  },
  {
    id: 'LD-2026-0037',
    titular: 'Pedro Alonso Martínez',
    nif: '52341890B',
    cups: 'ES0021000098765432BB0F',
    tarifa: '2.0TD',
    status: 'NUEVO',
    canal: 'Telemarketing',
    comercial: 'Raúl Moreno',
    fechaRegistro: '2026-06-03',
    comisionEst: 95.0,
    sipsOk: false,
    potencia: '3.45 kW',
  },
  {
    id: 'LD-2026-0036',
    titular: 'Industrias Metalúrgicas Vizcaya S.A.',
    empresa: 'IMVSA',
    nif: 'A48765432',
    cups: 'ES0031405678901234JH2F',
    tarifa: '6.4TD',
    status: 'ENVIADO A FIRMA',
    canal: 'Agente',
    comercial: 'Carlos Sanz',
    fechaRegistro: '2026-05-27',
    comisionEst: 14500.0,
    sipsOk: true,
    potencia: '1000 kW',
  },
  {
    id: 'LD-2026-0035',
    titular: 'Supermercados La Huerta S.L.',
    empresa: 'SLHUERTA',
    nif: 'B91234567',
    cups: 'ES0031401122334455JH0F',
    tarifa: '3.0TD',
    status: 'BORRADOR GENERADO',
    canal: 'Partner',
    comercial: 'Ana García',
    fechaRegistro: '2026-05-25',
    comisionEst: 2100.0,
    sipsOk: true,
    potencia: '80 kW',
  },
  {
    id: 'LD-2026-0034',
    titular: 'Clínica Dental Sonrisas S.L.',
    empresa: 'CDSONR',
    nif: 'B67890123',
    cups: 'ES0021000054321678CC0F',
    tarifa: '2.0TD',
    status: 'FIRMADO',
    canal: 'Online',
    comercial: 'Laura Jiménez',
    fechaRegistro: '2026-05-20',
    comisionEst: 340.0,
    sipsOk: true,
    potencia: '15 kW',
  },
  {
    id: 'LD-2026-0033',
    titular: 'Centro Comercial Aragón Plaza S.A.',
    empresa: 'CCAPLAZA',
    nif: 'A50123456',
    cups: 'ES0031402244556677JR0F',
    tarifa: '6.1TD',
    status: 'ENVIADO A FIRMA',
    canal: 'Directo',
    comercial: 'Carlos Sanz',
    fechaRegistro: '2026-05-22',
    comisionEst: 22000.0,
    sipsOk: true,
    potencia: '630 kW',
  },
  {
    id: 'LD-2026-0032',
    titular: 'Francisco Ruiz Pérez',
    nif: '12345678Z',
    cups: 'ES0021000011223344DD0F',
    tarifa: '2.0TD',
    status: 'NUEVO',
    canal: 'Telemarketing',
    comercial: 'Ana García',
    fechaRegistro: '2026-06-04',
    comisionEst: 120.0,
    sipsOk: false,
    potencia: '5.75 kW',
  },
  {
    id: 'LD-2026-0031',
    titular: 'Talleres Mecánicos Hermanos López S.L.',
    empresa: 'TMHL',
    nif: 'B28901234',
    cups: 'ES0031403344556677JH1F',
    tarifa: '3.0TD',
    status: 'BORRADOR GENERADO',
    canal: 'Agente',
    comercial: 'Raúl Moreno',
    fechaRegistro: '2026-05-29',
    comisionEst: 1850.0,
    sipsOk: true,
    potencia: '100 kW',
  },
  {
    id: 'LD-2026-0030',
    titular: 'Residencia Ancianos El Pinar S.L.',
    empresa: 'RAELP',
    nif: 'B73456789',
    cups: 'ES0031401234567890JH0F',
    tarifa: '6.3TD',
    status: 'FIRMADO',
    canal: 'Partner',
    comercial: 'Laura Jiménez',
    fechaRegistro: '2026-05-18',
    comisionEst: 5400.0,
    sipsOk: true,
    potencia: '250 kW',
  },
];

// ─── Config ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<LeadStatus, { badgeClass: string; label: string }> = {
  'NUEVO':             { badgeClass: 'badge-process', label: 'Nuevo' },
  'BORRADOR GENERADO': { badgeClass: 'badge-draft',   label: 'Borrador' },
  'ENVIADO A FIRMA':   { badgeClass: 'badge-warning', label: 'En firma' },
  'FIRMADO':           { badgeClass: 'badge-active',  label: 'Firmado' },
};

const KANBAN_CARDS = [
  {
    status: 'NUEVO' as LeadStatus,
    label: 'Nuevo',
    icon: Users,
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.4)',
  },
  {
    status: 'BORRADOR GENERADO' as LeadStatus,
    label: 'Borrador Generado',
    icon: FilePen,
    color: '#94A3B8',
    glow: 'rgba(148,163,184,0.10)',
    border: 'rgba(148,163,184,0.35)',
  },
  {
    status: 'ENVIADO A FIRMA' as LeadStatus,
    label: 'Enviado a Firma',
    icon: Send,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.4)',
  },
  {
    status: 'FIRMADO' as LeadStatus,
    label: 'Firmado',
    icon: BadgeCheck,
    color: '#22C55E',
    glow: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.4)',
  },
];

const PAGE_SIZE = 8;

// ─── Component ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCanal, setFilterCanal] = useState<string>('');
  const [page, setPage] = useState(1);

  // Counts per kanban status
  const kanbanCounts = useMemo(() => {
    const counts: Record<LeadStatus, number> = {
      'NUEVO': 0,
      'BORRADOR GENERADO': 0,
      'ENVIADO A FIRMA': 0,
      'FIRMADO': 0,
    };
    LEADS_DATA.forEach(l => counts[l.status]++);
    return counts;
  }, []);

  // Total estimated commission
  const totalComision = useMemo(
    () => LEADS_DATA.reduce((acc, l) => acc + l.comisionEst, 0),
    []
  );

  // Filtered data
  const filtered = useMemo(() => {
    return LEADS_DATA.filter(l => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        l.id.toLowerCase().includes(q) ||
        l.titular.toLowerCase().includes(q) ||
        l.nif.toLowerCase().includes(q) ||
        l.cups.toLowerCase().includes(q) ||
        (l.empresa ?? '').toLowerCase().includes(q);
      const matchStatus = !filterStatus || l.status === filterStatus;
      const matchCanal = !filterCanal || l.canal === filterCanal;
      return matchSearch && matchStatus && matchCanal;
    });
  }, [search, filterStatus, filterCanal]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = () => setPage(1);

  const fmt = (n: number) =>
    n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Leads"
        subtitle="Gestión de leads y envío de contratos para firma"
        action={{ label: 'Nuevo Lead', onClick: () => alert('Abrir modal Nuevo Lead') }}
      />

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Kanban Status Cards ─────────────────────────────────────────── */}
        <div
          className="animate-fade-in-up"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}
        >
          {KANBAN_CARDS.map((k, i) => {
            const Icon = k.icon;
            const count = kanbanCounts[k.status];
            const pct = Math.round((count / LEADS_DATA.length) * 100);
            return (
              <div
                key={k.status}
                className={`card-stat delay-${(i + 1) * 100}`}
                style={{
                  borderColor: k.border,
                  boxShadow: `0 0 24px ${k.glow}`,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => {
                  setFilterStatus(filterStatus === k.status ? '' : k.status);
                  handleFilterChange();
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: k.color,
                  borderRadius: '12px 12px 0 0',
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                      {k.label}
                    </p>
                    <p style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
                      {count}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {pct}% del total
                    </p>
                  </div>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: `${k.glow}`, border: `1px solid ${k.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={22} color={k.color} />
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: '14px', height: '4px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: k.color,
                    borderRadius: '4px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>

                {/* Active filter indicator */}
                {filterStatus === k.status && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: k.color,
                    boxShadow: `0 0 8px ${k.color}`,
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Commission KPI banner ───────────────────────────────────────── */}
        <div
          className="animate-fade-in-up delay-200"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(222,255,154,0.1)', border: '1px solid rgba(222,255,154,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="var(--lime)" />
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comisión Potencial Total</p>
              <p className="lime-glow-text font-mono-nums" style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.2 }}>
                {fmt(totalComision)} €
              </p>
            </div>
          </div>
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Leads activos', value: LEADS_DATA.filter(l => l.status !== 'FIRMADO').length },
              { label: 'SIPS Verificados', value: LEADS_DATA.filter(l => l.sipsOk).length },
              { label: 'Tasa conversión', value: `${Math.round((kanbanCounts['FIRMADO'] / LEADS_DATA.length) * 100)}%` },
            ].map(kpi => (
              <div key={kpi.label}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
                <p className="font-mono-nums" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
              <Download size={14} /> Exportar
            </button>
            <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────────────── */}
        <div
          className="animate-fade-in-up delay-300"
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              placeholder="Buscar por ID, titular, NIF, CUPS…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: '38px' }}
            />
          </div>

          {/* Estado filter */}
          <div style={{ position: 'relative', minWidth: '180px' }}>
            <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
            <select
              className="form-input"
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
            >
              <option value="">Todos los estados</option>
              <option value="NUEVO">Nuevo</option>
              <option value="BORRADOR GENERADO">Borrador Generado</option>
              <option value="ENVIADO A FIRMA">Enviado a Firma</option>
              <option value="FIRMADO">Firmado</option>
            </select>
          </div>

          {/* Canal filter */}
          <div style={{ position: 'relative', minWidth: '160px' }}>
            <Zap size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
            <select
              className="form-input"
              value={filterCanal}
              onChange={e => { setFilterCanal(e.target.value); setPage(1); }}
              style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
            >
              <option value="">Todos los canales</option>
              <option value="Directo">Directo</option>
              <option value="Agente">Agente</option>
              <option value="Telemarketing">Telemarketing</option>
              <option value="Partner">Partner</option>
              <option value="Online">Online</option>
            </select>
          </div>

          {/* Results count */}
          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filtered.length}</span> leads encontrados
          </div>
        </div>

        {/* ── Data Table ─────────────────────────────────────────────────── */}
        <div
          className="card animate-fade-in-up delay-400"
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>ID Lead</th>
                  <th>Titular / Empresa</th>
                  <th>NIF</th>
                  <th style={{ minWidth: '190px' }}>CUPS</th>
                  <th>Tarifa</th>
                  <th>SIPS</th>
                  <th>Estado</th>
                  <th>Canal</th>
                  <th>Comercial</th>
                  <th>Fecha Reg.</th>
                  <th style={{ textAlign: 'right' }}>Comisión Est.</th>
                  <th style={{ textAlign: 'center', width: '140px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      <Search size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                      No se encontraron leads con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  paginated.map(lead => {
                    const sc = STATUS_CONFIG[lead.status];
                    return (
                      <tr key={lead.id}>
                        {/* ID */}
                        <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 600, fontSize: '0.78rem' }}>
                          {lead.id}
                        </td>

                        {/* Titular */}
                        <td className="primary-cell" style={{ maxWidth: '200px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.titular}
                          </div>
                          {lead.empresa && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {lead.empresa}
                            </div>
                          )}
                        </td>

                        {/* NIF */}
                        <td className="mono-cell" style={{ fontSize: '0.78rem' }}>
                          {lead.nif}
                        </td>

                        {/* CUPS */}
                        <td className="mono-cell" style={{ fontSize: '0.73rem', letterSpacing: '0.02em' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {lead.cups.slice(0, 12)}
                          </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {lead.cups.slice(12)}
                          </span>
                        </td>

                        {/* Tarifa */}
                        <td>
                          <span className="badge badge-lime" style={{ fontSize: '0.72rem' }}>
                            {lead.tarifa}
                          </span>
                        </td>

                        {/* SIPS OK */}
                        <td style={{ textAlign: 'center' }}>
                          {lead.sipsOk ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle size={16} color="#22C55E" />
                              <span style={{ fontSize: '0.72rem', color: '#22C55E', fontWeight: 600 }}>OK</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <XCircle size={16} color="#EF4444" />
                              <span style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 600 }}>Pendiente</span>
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td>
                          <span className={`badge ${sc.badgeClass}`}>
                            {sc.label}
                          </span>
                        </td>

                        {/* Canal */}
                        <td style={{ fontSize: '0.83rem' }}>
                          <CanalBadge canal={lead.canal} />
                        </td>

                        {/* Comercial */}
                        <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-strong)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem', fontWeight: 700, color: 'var(--lime)',
                              flexShrink: 0,
                            }}>
                              {lead.comercial.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{lead.comercial}</span>
                          </div>
                        </td>

                        {/* Fecha Registro */}
                        <td className="mono-cell" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(lead.fechaRegistro).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>

                        {/* Comisión */}
                        <td className="mono-cell" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {fmt(lead.comisionEst)} €
                        </td>

                        {/* Acciones */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {lead.status === 'NUEVO' && (
                              <button
                                className="btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px' }}
                                title="Generar Borrador"
                              >
                                <FileText size={13} />
                                Borrador
                              </button>
                            )}
                            {lead.status === 'BORRADOR GENERADO' && (
                              <button
                                className="btn-secondary"
                                style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px', borderColor: '#F59E0B', color: '#F59E0B' }}
                                title="Enviar a Firma"
                              >
                                <Send size={13} />
                                Enviar
                              </button>
                            )}
                            {(lead.status === 'ENVIADO A FIRMA' || lead.status === 'FIRMADO') && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {lead.status === 'FIRMADO' ? '—' : 'En firma…'}
                              </span>
                            )}
                            <button
                              className="btn-ghost"
                              style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px' }}
                              title="Ver detalle"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              className="btn-ghost"
                              style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                              title="Más opciones"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ──────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mostrando{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </span>
              {' '}de{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filtered.length}</span>
              {' '}leads
            </span>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                className="btn-ghost"
                style={{ padding: '6px 10px' }}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    border: p === currentPage ? 'none' : '1px solid var(--border)',
                    background: p === currentPage ? 'var(--lime)' : 'var(--bg-elevated)',
                    color: p === currentPage ? 'var(--bg-base)' : 'var(--text-secondary)',
                    fontWeight: p === currentPage ? 700 : 400,
                    fontSize: '0.82rem', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                className="btn-ghost"
                style={{ padding: '6px 10px' }}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filas por página:</span>
              <span className="font-mono-nums" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{PAGE_SIZE}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Canal Badge helper ───────────────────────────────────────────────────────
function CanalBadge({ canal }: { canal: Canal }) {
  const config: Record<Canal, { bg: string; color: string }> = {
    Directo:      { bg: 'rgba(59,130,246,0.12)',   color: '#60A5FA' },
    Agente:       { bg: 'rgba(168,85,247,0.12)',   color: '#C084FC' },
    Telemarketing:{ bg: 'rgba(245,158,11,0.12)',   color: '#F59E0B' },
    Partner:      { bg: 'rgba(34,197,94,0.12)',    color: '#22C55E' },
    Online:       { bg: 'rgba(222,255,154,0.12)',  color: '#DEFF9A' },
  };
  const c = config[canal];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '99px',
      background: c.bg, color: c.color,
      fontSize: '0.72rem', fontWeight: 600,
    }}>
      {canal}
    </span>
  );
}
