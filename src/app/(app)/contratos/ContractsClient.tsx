'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import {
  Zap,
  Loader2,
  TrendingDown,
  BarChart3,
  Search,
  ChevronDown,
  Info,
  Pencil,
  FileText,
  MapPin,
  MessageSquare,
  Upload,
  Download,
  MoreVertical,
  ArrowUpDown
} from 'lucide-react';
import EditContractModal from './EditContractModal';
import PaginationFooter from '@/components/PaginationFooter';
/* ─────────────────────────── HELPERS ───────────────────────── */
const ESTADO_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVO:     { label: 'Activo',      badge: 'badge badge-active'   },
  ACEPTADO:   { label: 'Aceptado',    badge: 'px-2 py-1 rounded text-xs font-bold bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)]' },
  BORRADOR:   { label: 'Borrador',    badge: 'badge badge-draft'    },
  FINALIZADO: { label: 'Finalizado',  badge: 'badge badge-finalizado' },
  RECHAZADO:  { label: 'Rechazado',   badge: 'badge badge-danger'   },
  RECHAZO_DISTRIBUIDORA: { label: 'Rechazo Distribuidora', badge: 'badge badge-danger' },
  TRAMITANDO: { label: 'Tramitando',  badge: 'badge badge-process'  },
  VERIFICANDO_FIRMA: { label: 'Verificando Firma', badge: 'badge badge-warning' },
  BAJA:       { label: 'Baja',        badge: 'badge badge-danger'   },
  RENOVACION: { label: 'Renovación',  badge: 'badge badge-warning'  },
  DEFAULT:    { label: 'Desconocido', badge: 'badge badge-draft'    },
};

function truncateCups(cups: string | null) {
  if (!cups) return '—';
  return cups.length > 16 ? cups.slice(0, 8) + '…' + cups.slice(-6) : cups;
}

function formatDate(iso: Date | string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMwh(v: number | null) {
  if (!v) return '—';
  return v.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh';
}

const TARIFAS = ['Todas', '2.0TD', '3.0TD', '6.1TD'];
const CANALES = ['Todos', 'Directo', 'Agente', 'Broker', 'Online'];
const ESTADOS_FILTER = [
  'Todos', 
  'ACEPTADO', 
  'ACTIVO', 
  'BORRADOR', 
  'FINALIZADO', 
  'RECHAZADO', 
  'RECHAZO_DISTRIBUIDORA', 
  'TRAMITANDO', 
  'VERIFICANDO_FIRMA',
  'BAJA', 
  'RENOVACION'
];

/* ─────────────────────────── COMPONENT ──────────────────────────── */
export default function ContractsClient({ contracts, userRole = 'CANAL' }: { contracts: any[], userRole?: string }) {
  const router = useRouter();
  const [search, setSearch]         = useState('');
  const [estadoFilter, setEstado]   = useState('Todos');
  const [tarifaFilter, setTarifa]   = useState('Todas');
  const [canalFilter, setCanal]     = useState('Todos');
  
  const [sortCol, setSortCol]       = useState<string | null>('fechaRegistro');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [page, setPage]             = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
  const [editingContract, setEditingContract] = useState<any | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const canEdit = userRole === 'SUPERADMIN' || userRole === 'BACKOFFICE';

  const flatContracts = useMemo(() => {
    return contracts.map(c => ({
      id: c.id,
      cups: c.supplyPoint?.cups || c.lead?.cups || '—',
      cliente: c.client?.businessName || c.client?.firstName || c.lead?.businessName || c.lead?.firstName || 'Sin Cliente',
      direccion: c.supplyPoint?.address ? `${c.supplyPoint.address}, ${c.supplyPoint.postalCode || ''} ${c.supplyPoint.city || ''}` : 'Sin Dirección',
      estado: c.status || 'TRAMITANDO',
      tarifa: c.supplyPoint?.tariff || c.lead?.tariff || '—',
      consumoMwh: c.supplyPoint?.annualConsumption || c.lead?.estimatedMWh || 0,
      producto: c.product?.name || c.lead?.product || '—',
      canal: c.user?.channel?.name || c.lead?.source || '—',
      comercial: c.user?.name || c.user?.email || '—',
      fechaAlta: c.activationDate,
      fechaBaja: c.terminationDate,
      fechaFirma: c.signatureDate,
      fechaRegistro: c.createdAt,
      inicioPermanencia: c.permanenceStartDate,
      tramitacion: Array.isArray((c.lead?.contractData as any)?.['Tramitación a realizar']) 
        ? (c.lead?.contractData as any)?.['Tramitación a realizar'][0] 
        : (c.requestType || (c.lead?.contractData as any)?.['Tramitación a realizar'] || '—'),
      contractCode: c.contractCode || (c.lead?.contractData as any)?.['CONTRATO'] || null,
      observaciones: c.internalComments || '',
      signedUrl: c.signedUrl,
      draftUrl: c.draftUrl,
      annexUrl: c.annexUrl,
      raw: c,
    }));
  }, [contracts]);

  const filtered = useMemo(() => {
    let rows = flatContracts.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.cups.toLowerCase().includes(q) || c.cliente.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.producto.toLowerCase().includes(q);
      const matchEstado = estadoFilter === 'Todos' || c.estado === estadoFilter;
      const matchTarifa = tarifaFilter === 'Todas' || c.tarifa === tarifaFilter;
      const matchCanal  = canalFilter  === 'Todos' || c.canal  === canalFilter;
      return matchSearch && matchEstado && matchTarifa && matchCanal;
    });

    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const va = (a as any)[sortCol] ?? '';
        const vb = (b as any)[sortCol] ?? '';
        const cmp = String(va).localeCompare(String(vb), 'es', { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [flatContracts, search, estadoFilter, tarifaFilter, canalFilter, sortCol, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  const activos = flatContracts.filter(c => c.estado === 'ACTIVO').length;
  const tramitando = flatContracts.filter(c => c.estado === 'TRAMITANDO').length;
  const bajas = flatContracts.filter(c => c.estado === 'BAJA').length;
  const totalMwh = flatContracts.reduce((acc, c) => acc + (c.consumoMwh || 0), 0);

  const STATS = [
    { label: 'Contratos Activos', value: activos.toString(), delta: 'Actualizado', positive: true, icon: Zap, color: 'var(--success)', glow: 'rgba(34,197,94,0.12)' },
    { label: 'En Tramitación', value: tramitando.toString(), delta: 'Pendientes de activación', positive: null, icon: Loader2, color: 'var(--info)', glow: 'rgba(59,130,246,0.12)' },
    { label: 'Bajas', value: bajas.toString(), delta: 'Histórico', positive: true, icon: TrendingDown, color: 'var(--danger)', glow: 'rgba(239,68,68,0.10)' },
    { label: 'MWh Totales', value: totalMwh.toLocaleString('es-ES', { maximumFractionDigits: 0 }), delta: 'Cartera actual', positive: true, icon: BarChart3, color: 'var(--lime)', glow: 'var(--lime-glow)' },
  ];

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Contratos" subtitle="Gestión de contratos de suministro eléctrico" />

      <div style={{ padding: '28px 28px 48px' }}>
        
        {/* STAT CARDS */}
        <div className="animate-fade-in-up grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: s.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${s.glow}` }}>
                    <Icon size={16} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{s.value}</div>
                <div style={{ marginTop: '8px', fontSize: '0.74rem', color: s.positive === true ? 'var(--success)' : s.positive === false ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 500 }}>{s.delta}</div>
              </div>
            );
          })}
        </div>

        {/* TABLE CARD */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0 }}>
          
          {/* FILTERS */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="form-input" placeholder="Buscar CUPS, cliente, contrato, producto…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '36px' }} />
            </div>

            <div style={{ position: 'relative', minWidth: '160px' }}>
              <select className="form-input" value={estadoFilter} onChange={e => { setEstado(e.target.value); setPage(1); }} style={{ paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}>
                {ESTADOS_FILTER.map(e => <option key={e} value={e}>{e === 'Todos' ? 'Estado: Todos' : ESTADO_CONFIG[e]?.label ?? e}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>

            <div style={{ position: 'relative', minWidth: '140px' }}>
              <select className="form-input" value={tarifaFilter} onChange={e => { setTarifa(e.target.value); setPage(1); }} style={{ paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}>
                {TARIFAS.map(t => <option key={t} value={t}>{t === 'Todas' ? 'Tarifa: Todas' : t}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>

            <div style={{ position: 'relative', minWidth: '140px' }}>
              <select className="form-input" value={canalFilter} onChange={e => { setCanal(e.target.value); setPage(1); }} style={{ paddingRight: '36px', appearance: 'none', cursor: 'pointer' }}>
                {CANALES.map(c => <option key={c} value={c}>{c === 'Todos' ? 'Canal: Todos' : c}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Mostrando <span style={{ color: 'var(--lime)', fontWeight: 600 }}>{filtered.length}</span> de {flatContracts.length}
            </div>
          </div>

          {/* TABLE DATA */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    { key: 'cups',       label: 'CUPS / Contrato' },
                    { key: 'cliente',    label: 'Cliente y Dirección' },
                    { key: 'estado',     label: 'Estado' },
                    { key: 'producto',   label: 'Producto y Tarifa' },
                    { key: 'consumoMwh', label: 'Consumo' },
                    { key: 'fechaRegistro', label: 'Creación (Registro)' },
                    { key: 'fechaAlta',  label: 'Fechas (Alta/Baja)' },
                    { key: 'canal',      label: 'Canal' },
                    { key: 'comercial',  label: 'Comercial' },
                    { key: null,         label: 'Obs.' },
                    { key: null,         label: 'Acciones', align: 'right' },
                  ].map((col, idx) => (
                    <th
                      key={idx}
                      onClick={col.key ? () => handleSort(col.key as string) : undefined}
                      style={{
                        cursor: col.key ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        textAlign: col.align === 'right' ? 'right' : 'left'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start', width: '100%' }}>
                        {col.label}
                        {col.key && <ArrowUpDown size={11} style={{ color: sortCol === col.key ? 'var(--lime)' : 'var(--text-muted)', opacity: sortCol === col.key ? 1 : 0.5 }} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      <FileText size={32} style={{ marginBottom: '8px', opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                      No se encontraron contratos con los filtros aplicados.
                    </td>
                  </tr>
                ) : paginated.map((c) => {
                  const est = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG.DEFAULT;
                  const estUpper = String(c.estado).toUpperCase();
                  const hasSignedDoc = !!c.signedUrl || ['FIRMADO', 'ACEPTADO', 'ACTIVO', 'FINALIZADO', 'TRAMITANDO'].includes(estUpper);

                  return (
                    <tr key={c.id} style={{ transition: 'background 0.15s ease' }} className="hover:bg-white/[0.02]">
                      
                      {/* CUPS y Contrato */}
                      <td className="mono-cell">
                        <div style={{ color: 'var(--lime)', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '4px' }} title={c.cups}>
                          {truncateCups(c.cups)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {c.contractCode || `ID: ${c.id}`}
                        </div>
                      </td>

                      {/* Cliente y Dirección */}
                      <td className="primary-cell" style={{ maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
                          {c.cliente}
                        </div>
                        <div className="flex items-center text-[var(--text-muted)] text-xs" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <MapPin size={10} className="mr-1 shrink-0" />
                          <span className="truncate" title={c.direccion}>{c.direccion}</span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td>
                        <span className={est.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
                          {est.label}
                        </span>
                        {c.tramitacion !== '—' && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
                            TRÁMITE: {c.tramitacion}
                          </div>
                        )}
                      </td>

                      {/* Producto y Tarifa */}
                      <td>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.85rem', marginBottom: '4px' }}>
                          {c.producto}
                        </div>
                        <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                          {c.tarifa}
                        </span>
                      </td>

                      {/* Consumo */}
                      <td className="mono-cell" style={{ color: 'var(--text-primary)' }}>
                        {formatMwh(c.consumoMwh)}
                      </td>

                      {/* Fecha Registro */}
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(c.fechaRegistro)}
                      </td>

                      {/* Fechas */}
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          <span className="text-gray-500 mr-1">Alta:</span> {formatDate(c.fechaAlta)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span className="text-gray-600 mr-1">Inic. Perm.:</span> {formatDate(c.inicioPermanencia)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span className="text-gray-600 mr-1">Baja:</span> {formatDate(c.fechaBaja)}
                        </div>
                      </td>

                      {/* Canal */}
                      <td style={{ fontSize: '0.83rem' }}>
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{c.canal}</span>
                      </td>

                      {/* Comercial */}
                      <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: 700, color: 'var(--lime)', flexShrink: 0,
                          }}>
                            {String(c.comercial).slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{c.comercial}</span>
                        </div>
                      </td>

                      {/* Observaciones Hover */}
                      <td style={{ textAlign: 'center' }}>
                        {c.observaciones ? (
                          <div className="relative group cursor-help inline-block">
                            <MessageSquare size={16} className="text-[var(--lime)] opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-800 text-xs text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 border border-white/10 text-left">
                              <p className="font-semibold mb-1 text-lime-400">Observaciones</p>
                              <p className="whitespace-pre-wrap">{c.observaciones}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600 opacity-30">-</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex justify-end gap-1 items-center">
                          <button 
                            onClick={() => router.push(`/contratos/${c.id}`)}
                            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
                            title="Ver Detalle"
                          >
                            <Info size={16} />
                          </button>

                          {canEdit && (
                            <button 
                              onClick={() => setEditingContract(c.raw)}
                              className="p-1.5 text-gray-400 hover:text-[var(--lime)] rounded hover:bg-[rgba(132,204,22,0.1)] transition-colors"
                              title="Editar Contrato"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                          <div className="relative">
                            <button 
                              onClick={() => setOpenDropdown(openDropdown === c.id ? null : c.id)}
                              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {openDropdown === c.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                <div className="absolute right-0 top-full mt-1 w-56 bg-[#2A2A2A] border border-white/10 rounded-lg shadow-2xl py-1 z-20 animate-in fade-in zoom-in-95 text-left">
                                  {hasSignedDoc ? (
                                    <>
                                      <a href={c.signedUrl || '#'} target="_blank" rel="noreferrer" className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                        <Download size={14} /> Descargar doc. firmado
                                      </a>
                                      {c.annexUrl && (
                                        <a href={c.annexUrl} target="_blank" rel="noreferrer" className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                          <Download size={14} /> Descargar Anexo firmado
                                        </a>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setOpenDropdown(null); if (canEdit) setEditingContract(c.raw); else alert("Contacte al backoffice para subir documentos."); }} className="w-full text-left px-4 py-2.5 text-xs text-[var(--lime)] hover:text-white hover:bg-[rgba(132,204,22,0.1)] flex items-center gap-2">
                                        <Upload size={14} /> 
                                        {c.tramitacion === 'M1' || c.tramitacion === 'M1N' ? 'Subir Anexo firmado' : 'Subir contrato firmado'}
                                      </button>
                                      <a href={c.draftUrl || '#'} target="_blank" rel="noreferrer" className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                        <Download size={14} /> Descargar Borrador PDF
                                      </a>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationFooter
            currentPage={page}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="contratos"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>

      <EditContractModal 
        isOpen={!!editingContract} 
        onClose={() => setEditingContract(null)} 
        contract={editingContract || {}} 
        onSuccess={handleRefresh} 
      />
    </div>
  );
}
