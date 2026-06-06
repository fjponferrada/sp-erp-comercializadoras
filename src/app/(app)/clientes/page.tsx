'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import {
  Users,
  FileCheck2,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Building2,
  User,
  SlidersHorizontal,
  TrendingUp,
  Zap,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
type TipoPersona = 'Empresa' | 'Particular';

interface Cliente {
  id: string;
  nif: string;
  nombre: string;
  tipo: TipoPersona;
  contratos: number;
  cupsActivos: number;
  email: string;
  telefono: string;
  fechaAlta: string;
  esNuevo: boolean;
}

/* ─── Mock Data ──────────────────────────────────────────── */
const CLIENTES: Cliente[] = [
  {
    id: 'CLI-0001',
    nif: 'A28015264',
    nombre: 'Iberdrola Redes España, S.A.U.',
    tipo: 'Empresa',
    contratos: 14,
    cupsActivos: 12,
    email: 'contratos@iberdrola.es',
    telefono: '+34 944 151 411',
    fechaAlta: '2024-01-10',
    esNuevo: false,
  },
  {
    id: 'CLI-0002',
    nif: 'B82288452',
    nombre: 'Comercial Eléctrica Levante, S.L.',
    tipo: 'Empresa',
    contratos: 7,
    cupsActivos: 7,
    email: 'gestion@cellevante.com',
    telefono: '+34 963 421 800',
    fechaAlta: '2024-03-22',
    esNuevo: false,
  },
  {
    id: 'CLI-0003',
    nif: '48920341R',
    nombre: 'García Moreno, Antonio',
    tipo: 'Particular',
    contratos: 1,
    cupsActivos: 1,
    email: 'a.garcia.moreno@gmail.com',
    telefono: '+34 612 309 871',
    fechaAlta: '2024-04-05',
    esNuevo: false,
  },
  {
    id: 'CLI-0004',
    nif: 'A80209530',
    nombre: 'Endesa Distribución Eléctrica, S.L.',
    tipo: 'Empresa',
    contratos: 22,
    cupsActivos: 19,
    email: 'contratos.endesa@enel.com',
    telefono: '+34 900 130 022',
    fechaAlta: '2023-11-15',
    esNuevo: false,
  },
  {
    id: 'CLI-0005',
    nif: '36741082M',
    nombre: 'Fernández Ruiz, Carmen',
    tipo: 'Particular',
    contratos: 2,
    cupsActivos: 2,
    email: 'carmen.fdz@hotmail.com',
    telefono: '+34 698 541 203',
    fechaAlta: '2024-05-18',
    esNuevo: false,
  },
  {
    id: 'CLI-0006',
    nif: 'B63209187',
    nombre: 'Soluciones Energéticas Cataluña, S.L.',
    tipo: 'Empresa',
    contratos: 5,
    cupsActivos: 4,
    email: 'admin@sec-energia.cat',
    telefono: '+34 932 876 540',
    fechaAlta: '2024-06-01',
    esNuevo: true,
  },
  {
    id: 'CLI-0007',
    nif: '52184730K',
    nombre: 'López Sánchez, Miguel Ángel',
    tipo: 'Particular',
    contratos: 1,
    cupsActivos: 1,
    email: 'mlopez.s@icloud.com',
    telefono: '+34 655 872 119',
    fechaAlta: '2026-05-30',
    esNuevo: true,
  },
  {
    id: 'CLI-0008',
    nif: 'A58592642',
    nombre: 'Gas Natural Fenosa Distribución, S.A.',
    tipo: 'Empresa',
    contratos: 31,
    cupsActivos: 28,
    email: 'suministros@naturgy.es',
    telefono: '+34 900 100 212',
    fechaAlta: '2023-09-03',
    esNuevo: false,
  },
  {
    id: 'CLI-0009',
    nif: 'B95061835',
    nombre: 'Energías Renovables del Norte, S.L.',
    tipo: 'Empresa',
    contratos: 3,
    cupsActivos: 3,
    email: 'info@ernorte.es',
    telefono: '+34 944 680 321',
    fechaAlta: '2026-06-02',
    esNuevo: true,
  },
  {
    id: 'CLI-0010',
    nif: '78309214F',
    nombre: 'Martínez Iglesias, Paula',
    tipo: 'Particular',
    contratos: 1,
    cupsActivos: 0,
    email: 'paulamartinez@yahoo.es',
    telefono: '+34 629 043 887',
    fechaAlta: '2024-02-11',
    esNuevo: false,
  },
  {
    id: 'CLI-0011',
    nif: 'A82023169',
    nombre: 'Repsol Electricidad y Gas, S.A.',
    tipo: 'Empresa',
    contratos: 18,
    cupsActivos: 16,
    email: 'electricidad@repsol.com',
    telefono: '+34 917 538 100',
    fechaAlta: '2023-08-20',
    esNuevo: false,
  },
  {
    id: 'CLI-0012',
    nif: '19374850X',
    nombre: 'Navarro Castillo, Javier',
    tipo: 'Particular',
    contratos: 2,
    cupsActivos: 2,
    email: 'j.navarro.c@gmail.com',
    telefono: '+34 687 234 905',
    fechaAlta: '2026-06-05',
    esNuevo: true,
  },
];

/* ─── Stat Card ──────────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  delay?: string;
}) {
  return (
    <div className={`card-stat animate-fade-in-up ${delay ?? ''}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
            {label}
          </p>
          <p
            className={accent ? 'lime-glow-text font-mono-nums' : 'font-mono-nums'}
            style={{ fontSize: '2rem', fontWeight: 800, margin: '8px 0 4px', lineHeight: 1 }}
          >
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              {sub}
            </p>
          )}
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: accent ? 'rgba(222,255,154,0.12)' : 'var(--bg-elevated)',
            border: `1px solid ${accent ? 'rgba(222,255,154,0.25)' : 'var(--border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} color={accent ? 'var(--lime)' : 'var(--text-muted)'} />
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
const PAGE_SIZE = 8;

export default function ClientesPage() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'Todos' | TipoPersona>('Todos');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Derived stats */
  const totalClientes = CLIENTES.length;
  const conContratoActivo = CLIENTES.filter((c) => c.cupsActivos > 0).length;
  const nuevosEsteMes = CLIENTES.filter((c) => c.esNuevo).length;

  /* Filtered data */
  const filtered = useMemo(() => {
    return CLIENTES.filter((c) => {
      const matchSearch =
        search === '' ||
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.nif.toLowerCase().includes(search.toLowerCase());
      const matchTipo = tipoFilter === 'Todos' || c.tipo === tipoFilter;
      return matchSearch && matchTipo;
    });
  }, [search, tipoFilter]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleTipo = (v: 'Todos' | TipoPersona) => {
    setTipoFilter(v);
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Topbar ── */}
      <Topbar
        title="Clientes"
        subtitle="Base de datos de clientes y titulares de contrato"
        action={{ label: 'Nuevo Cliente', onClick: () => alert('Nuevo Cliente') }}
      />

      {/* ── Body ── */}
      <main style={{ padding: '28px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <StatCard
            icon={Users}
            label="Total Clientes"
            value={totalClientes}
            sub="Registros activos en el sistema"
            delay="delay-100"
          />
          <StatCard
            icon={FileCheck2}
            label="Con Contrato Activo"
            value={conContratoActivo}
            sub={`${Math.round((conContratoActivo / totalClientes) * 100)}% de la cartera`}
            accent
            delay="delay-200"
          />
          <StatCard
            icon={UserPlus}
            label="Nuevos Este Mes"
            value={nuevosEsteMes}
            sub="Alta en junio 2026"
            delay="delay-300"
          />
        </div>

        {/* ── Main Card ── */}
        <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Card header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="lime-dot" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Base de Clientes
              </span>
              <span
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 99,
                  padding: '2px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {filtered.length} resultados
              </span>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SlidersHorizontal size={14} color="var(--text-muted)" />

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: 32, width: 260, fontSize: '0.85rem' }}
                  placeholder="Buscar por nombre o NIF/CIF…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              {/* Tipo persona dropdown */}
              <select
                className="form-input"
                style={{ width: 170, fontSize: '0.85rem', cursor: 'pointer' }}
                value={tipoFilter}
                onChange={(e) => handleTipo(e.target.value as 'Todos' | TipoPersona)}
              >
                <option value="Todos">Todos los tipos</option>
                <option value="Empresa">Empresa</option>
                <option value="Particular">Particular</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIF / CIF</th>
                  <th>Nombre / Razón Social</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'center' }}>Nº Contratos</th>
                  <th style={{ textAlign: 'center' }}>CUPS Activos</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}
                    >
                      <Users size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>No se encontraron clientes con los filtros aplicados.</p>
                    </td>
                  </tr>
                ) : (
                  pageData.map((cliente) => {
                    const isSelected = selectedId === cliente.id;
                    return (
                      <tr
                        key={cliente.id}
                        onClick={() => setSelectedId(isSelected ? null : cliente.id)}
                        style={{
                          cursor: 'pointer',
                          borderLeft: isSelected
                            ? '3px solid var(--lime)'
                            : '3px solid transparent',
                          transition: 'border-left-color 0.2s ease',
                        }}
                      >
                        {/* NIF */}
                        <td className="mono-cell" style={{ color: 'var(--text-muted)' }}>
                          {cliente.nif}
                        </td>

                        {/* Nombre */}
                        <td className="primary-cell" style={{ maxWidth: 240 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                background:
                                  cliente.tipo === 'Empresa'
                                    ? 'rgba(59,130,246,0.12)'
                                    : 'rgba(168,85,247,0.12)',
                                border: `1px solid ${cliente.tipo === 'Empresa' ? 'rgba(59,130,246,0.25)' : 'rgba(168,85,247,0.25)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {cliente.tipo === 'Empresa' ? (
                                <Building2 size={13} color="#60A5FA" />
                              ) : (
                                <User size={13} color="#C084FC" />
                              )}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.87rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                                {cliente.nombre}
                              </p>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                {cliente.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Tipo Badge */}
                        <td>
                          {cliente.tipo === 'Empresa' ? (
                            <span className="badge badge-process">
                              <Building2 size={10} />
                              Empresa
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(168,85,247,0.15)',
                                color: '#C084FC',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <User size={10} />
                              Particular
                            </span>
                          )}
                          {cliente.esNuevo && (
                            <span className="badge badge-lime" style={{ marginLeft: 6 }}>
                              Nuevo
                            </span>
                          )}
                        </td>

                        {/* Nº Contratos */}
                        <td className="mono-cell" style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 6,
                              padding: '2px 10px',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                            }}
                          >
                            {cliente.contratos}
                          </span>
                        </td>

                        {/* CUPS Activos */}
                        <td className="mono-cell" style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              background:
                                cliente.cupsActivos > 0
                                  ? 'rgba(34,197,94,0.12)'
                                  : 'rgba(239,68,68,0.1)',
                              border: `1px solid ${cliente.cupsActivos > 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
                              color: cliente.cupsActivos > 0 ? 'var(--success)' : 'var(--danger)',
                              borderRadius: 6,
                              padding: '2px 10px',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            {cliente.cupsActivos > 0 && <Zap size={10} />}
                            {cliente.cupsActivos}
                          </span>
                        </td>

                        {/* Email */}
                        <td style={{ fontSize: '0.82rem', maxWidth: 200 }}>
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 200,
                            }}
                          >
                            {cliente.email}
                          </span>
                        </td>

                        {/* Teléfono */}
                        <td className="mono-cell" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {cliente.telefono}
                        </td>

                        {/* Acciones */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn-ghost"
                            style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Ver ficha de ${cliente.nombre}`);
                            }}
                          >
                            <ExternalLink size={12} />
                            Ver ficha
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ── */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Info */}
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mostrando{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)}
              </span>{' '}
              de{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{filtered.length}</span>{' '}
              clientes
            </p>

            {/* Page buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn-ghost"
                style={{ padding: '6px 10px' }}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    border: p === safePage ? '1px solid var(--lime)' : '1px solid var(--border)',
                    background: p === safePage ? 'rgba(222,255,154,0.12)' : 'var(--bg-elevated)',
                    color: p === safePage ? 'var(--lime)' : 'var(--text-secondary)',
                    fontWeight: p === safePage ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                className="btn-ghost"
                style={{ padding: '6px 10px' }}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Trend badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 8,
                padding: '5px 12px',
              }}
            >
              <TrendingUp size={12} color="var(--success)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                +{nuevosEsteMes} alta{nuevosEsteMes !== 1 ? 's' : ''} este mes
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
