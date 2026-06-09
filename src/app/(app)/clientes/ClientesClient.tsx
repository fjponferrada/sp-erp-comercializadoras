'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import PaginationFooter from '@/components/PaginationFooter';
import {
  Users,
  FileCheck2,
  UserPlus,
  Search,
  ExternalLink,
  Building2,
  User,
  SlidersHorizontal,
  TrendingUp,
  Zap,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
type TipoPersona = 'Empresa' | 'Particular';

export interface ClienteData {
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
import { useRouter } from 'next/navigation';

export default function ClientesClient({ clientes, userRole }: { clientes: ClienteData[], userRole?: string }) {
  const router = useRouter();
  const canCreate = userRole === 'SUPERADMIN' || userRole === 'BACKOFFICE';
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'Todos' | TipoPersona>('Todos');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Derived stats */
  const totalClientes = clientes.length;
  const conContratoActivo = clientes.filter((c) => c.cupsActivos > 0).length;
  const nuevosEsteMes = clientes.filter((c) => c.esNuevo).length;

  /* Filtered data */
  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const matchSearch =
        search === '' ||
        c.nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.nif.toLowerCase().includes(search.toLowerCase());
      const matchTipo = tipoFilter === 'Todos' || c.tipo === tipoFilter;
      return matchSearch && matchTipo;
    });
  }, [clientes, search, tipoFilter]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

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
      <Topbar
        title="Clientes"
        subtitle="Base de datos de clientes y titulares de contrato"
        action={canCreate ? { label: 'Nuevo Cliente', onClick: () => alert('Nuevo Cliente') } : undefined}
      />

      <main style={{ padding: '28px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

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
            sub={`${totalClientes ? Math.round((conContratoActivo / totalClientes) * 100) : 0}% de la cartera`}
            accent
            delay="delay-200"
          />
          <StatCard
            icon={UserPlus}
            label="Nuevos Este Mes"
            value={nuevosEsteMes}
            sub="Alta reciente"
            delay="delay-300"
          />
        </div>

        <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>

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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SlidersHorizontal size={14} color="var(--text-muted)" />

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
                        <td className="mono-cell" style={{ color: 'var(--text-muted)' }}>
                          {cliente.nif}
                        </td>

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
                              </div>
                          </div>
                        </td>

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

                        <td className="mono-cell" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {cliente.telefono}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn-ghost"
                            style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/clientes/${cliente.id}`);
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

          <PaginationFooter
            currentPage={safePage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="clientes"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </main>
    </div>
  );
}
