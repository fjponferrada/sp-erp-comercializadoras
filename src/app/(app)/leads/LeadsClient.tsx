'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import PaginationFooter from '@/components/PaginationFooter';
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
  Copy,
  RefreshCw,
  Sun,
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import NewLeadModal from './NewLeadModal';
import NewSolarLeadModal from '@/components/NewSolarLeadModal';
import { duplicateLeadAction, forceRefreshSipsAction, getPaginatedLeadsAction, getLeadStatsAction } from '@/app/actions/leadActions';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadStatus = 'NUEVO' | 'BORRADOR GENERADO' | 'ENVIADO A FIRMA' | 'FIRMADO' | string;
type Canal = 'Directo' | 'Agente' | 'Telemarketing' | 'Partner' | 'Online' | string;

export interface LeadData {
  id: string;
  titular: string;
  empresa?: string;
  nif: string;
  cups: string;
  tarifa: string;
  status: string;
  canal: string;
  comercial: string;
  fechaRegistro: string;
  comisionEst: number;
  sipsOk: boolean;
  potencia: string;
  documentsCount: number;
  rawLead?: any;
  type?: string;
  address?: string;
  contractId?: string;
  contractCode?: string;
}

const STATUS_CONFIG: Record<string, { badgeClass: string; label: string }> = {
  'NUEVO':             { badgeClass: 'badge-process', label: 'Nuevo' },
  'BORRADOR GENERADO': { badgeClass: 'badge-draft',   label: 'Borrador' },
  'ENVIADO A FIRMA':   { badgeClass: 'badge-warning', label: 'En firma' },
  'FIRMADO':           { badgeClass: 'badge-active',  label: 'Firmado' },
};

const KANBAN_CARDS = [
  {
    status: 'NUEVO',
    label: 'Nuevo',
    icon: Users,
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.4)',
  },
  {
    status: 'BORRADOR GENERADO',
    label: 'Borrador Generado',
    icon: FilePen,
    color: '#94A3B8',
    glow: 'rgba(148,163,184,0.10)',
    border: 'rgba(148,163,184,0.35)',
  },
  {
    status: 'ENVIADO A FIRMA',
    label: 'Enviado a Firma',
    icon: Send,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.4)',
  },
  {
    status: 'FIRMADO',
    label: 'Firmado',
    icon: BadgeCheck,
    color: '#22C55E',
    glow: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.4)',
  },
];



export default function LeadsClient({ initialChannels = [] }: { initialChannels?: string[] }) {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ totalLeads: number, statusCounts: Record<string, number>, totalMWh: number }>({
    totalLeads: 0, statusCounts: {}, totalMWh: 0
  });

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCanal, setFilterCanal] = useState<string>('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'opportunity' | 'contract'>('contract');
  const [leadToEdit, setLeadToEdit] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isNewSolarModalOpen, setIsNewSolarModalOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'user';
  const showEstudioFV = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = { search, status: filterStatus, canal: filterCanal };
      const [leadsRes, statsRes] = await Promise.all([
        getPaginatedLeadsAction(filters, page, itemsPerPage),
        getLeadStatsAction(filters)
      ]);
      setLeads(leadsRes.leads);
      setTotalItems(statsRes.totalLeads);
      setStats(statsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [search, filterStatus, filterCanal, page, itemsPerPage]);

  useEffect(() => {
    const debounceId = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(debounceId);
  }, [loadData]);

  const canEdit = userRole === 'SUPERADMIN' || userRole === 'BACKOFFICE';

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDuplicate = async (leadId: string) => {
    try {
      const res = await duplicateLeadAction(leadId);
      if (res.success) {
        setSearch('');
        setFilterStatus('');
        setFilterCanal('');
        setPage(1);
        loadData();
      }
    } catch (error) {
      console.error('Error al duplicar:', error);
      alert('Error al duplicar el Lead');
    }
  };

  const handleRefreshSips = async (leadId: string) => {
    try {
      const res = await forceRefreshSipsAction(leadId);
      if (res.success) {
        alert('SIPS actualizado correctamente');
        loadData();
      } else {
        alert(res.message || 'Error al actualizar SIPS');
      }
    } catch (error) {
      console.error('Error refrescando SIPS:', error);
      alert('Error al conectar con INGEBAU');
    }
  };

  const kanbanCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'NUEVO': 0,
      'BORRADOR GENERADO': 0,
      'ENVIADO A FIRMA': 0,
      'FIRMADO': 0,
    };
    if (stats.statusCounts) {
      Object.entries(stats.statusCounts).forEach(([k, v]) => {
        counts[k] = (counts[k] || 0) + v;
      });
    }
    return counts;
  }, [stats.statusCounts]);

  const totalComision = stats.totalMWh * 15; // Estimación provisional basada en el totalMWh devuelto

  const canalesDropdown = useMemo(() => ['Todos', ...initialChannels], [initialChannels]);

  const handleFilterChange = () => setPage(1);

  const fmt = (n: number) =>
    n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Oportunidades y Leads" 
        subtitle="Gestión comercial de suministros y proyectos"
        showSearch={false}
        customActions={
          <div className="flex gap-2">
            {showEstudioFV && (
              <button className="btn-secondary" onClick={() => setIsNewSolarModalOpen(true)} style={{ borderColor: '#FCD34D', color: '#FCD34D' }}>
                <Sun size={14} strokeWidth={2.5} />
                Estudio FV
              </button>
            )}
            <button className="btn-secondary" onClick={() => { setModalMode('opportunity'); setIsNewLeadModalOpen(true); }} style={{ borderColor: '#F97316', color: '#F97316' }}>
              <FileText size={14} strokeWidth={2.5} />
              Crear Oferta
            </button>
            <button className="btn-primary" onClick={() => { setModalMode('contract'); setIsNewLeadModalOpen(true); }}>
              <Plus size={14} strokeWidth={2.5} />
              Alta Luz
            </button>
          </div>
        }
      />
      
      <NewLeadModal 
        isOpen={isNewLeadModalOpen}
        onClose={() => { setIsNewLeadModalOpen(false); setLeadToEdit(null); }} 
        mode={modalMode}
        leadToEdit={leadToEdit}
      />

      {isNewSolarModalOpen && (
        <NewSolarLeadModal 
          onClose={() => setIsNewSolarModalOpen(false)} 
          onSuccess={(newId: string) => {
            setIsNewSolarModalOpen(false);
            router.push(`/leads/${newId}`);
          }}
        />
      )}

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div
          className="animate-fade-in-up"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}
        >
          {KANBAN_CARDS.map((k, i) => {
            const Icon = k.icon;
            const count = kanbanCounts[k.status] || 0;
            const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;
            return (
              <div
                key={k.status}
                className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}
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

                <div style={{ marginTop: '14px', height: '4px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: k.color,
                    borderRadius: '4px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>

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
              { label: 'Leads totales', value: stats.totalLeads },
              { label: 'Firmados', value: kanbanCounts['FIRMADO'] || 0 },
              { label: 'Tasa conversión', value: `${stats.totalLeads ? Math.round(((kanbanCounts['FIRMADO'] || 0) / stats.totalLeads) * 100) : 0}%` },
            ].map(kpi => (
              <div key={kpi.label}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
                <p className="font-mono-nums" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="animate-fade-in-up delay-300"
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
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

          <div style={{ position: 'relative', minWidth: '160px' }}>
            <Zap size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
            <select
              className="form-input"
              value={filterCanal}
              onChange={e => { setFilterCanal(e.target.value); setPage(1); }}
              style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
            >
              {canalesDropdown.map(c => (
                <option key={c} value={c === 'Todos' ? '' : c}>
                  {c === 'Todos' ? 'Todos los canales' : c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalItems}</span> leads encontrados
          </div>
        </div>

        <div
          className="card animate-fade-in-up delay-400"
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Titular / Empresa</th>
                  <th>Dirección Suministro</th>
                  <th style={{ width: '130px' }}>Contrato Asc.</th>
                  <th>Fecha Registro</th>
                  <th style={{ minWidth: '190px' }}>CUPS</th>
                  <th>Tarifa</th>
                  <th>SIPS</th>
                  <th>Canal</th>
                  <th>Comercial</th>
                  <th style={{ textAlign: 'center', width: '140px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                      Cargando leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      <Search size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                      No se encontraron leads con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => {
                    return (
                      <tr 
                        key={lead.id} 
                        className="animate-fade-in-up" 
                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('.btn-view')) return;
                          router.push(`/leads/${lead.id}`);
                        }}
                      >
                        <td className="primary-cell" style={{ maxWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lead.titular}
                            </div>
                            {lead.rawLead?.generateOffer && (
                              <div>
                                <FileText size={14} color="var(--orange)" />
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="primary-cell" style={{ maxWidth: '200px' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.address || 'Pendiente'}
                          </div>
                        </td>

                        <td className="mono-cell" style={{ fontSize: '0.78rem', color: lead.contractCode ? 'var(--lime)' : 'var(--text-muted)' }}>
                          {lead.contractCode || ''}
                        </td>

                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {new Date(lead.fechaRegistro).toLocaleDateString('es-ES')}
                        </td>

                        <td className="mono-cell" style={{ fontSize: '0.73rem', letterSpacing: '0.02em' }}>
                          {lead.cups || <span style={{ color: 'var(--text-muted)' }}>Pendiente</span>}
                        </td>

                        <td>
                          <span className="badge badge-lime" style={{ fontSize: '0.72rem' }}>
                            {lead.tarifa}
                          </span>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {lead.sipsOk ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <CheckCircle size={16} color="#22C55E" />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <XCircle size={16} color="#EF4444" />
                            </div>
                          )}
                        </td>

                        <td style={{ fontSize: '0.83rem' }}>
                          <span style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{lead.canal}</span>
                        </td>

                        <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem', fontWeight: 700, color: 'var(--lime)', flexShrink: 0,
                            }}>
                              {String(lead.comercial || 'SI').slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{String(lead.comercial || 'Sistema')}</span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {canEdit && (
                              <button 
                                className="btn-ghost" 
                                style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px', color: 'var(--orange)' }} 
                                title="Editar Avanzado" 
                                onClick={(e) => { e.stopPropagation(); setLeadToEdit(lead.rawLead); setModalMode(lead.type === 'FV' ? 'opportunity' : 'contract'); setIsNewLeadModalOpen(true); }}
                              >
                                <FilePen size={13} />
                              </button>
                            )}
                            <button className="btn-ghost btn-view" style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px' }} title="Ver detalle" onClick={(e) => { e.stopPropagation(); router.push(`/leads/${lead.id}`); }}>
                              <Eye size={13} />
                            </button>
                            <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px' }} title="Refrescar SIPS" onClick={(e) => { e.stopPropagation(); handleRefreshSips(lead.id); }}>
                              <RefreshCw size={13} />
                            </button>
                            <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: '0.72rem', gap: '4px', color: 'var(--blue)' }} title="Duplicar Lead" onClick={(e) => { e.stopPropagation(); handleDuplicate(lead.id); }}>
                              <Copy size={13} />
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

          <PaginationFooter
            currentPage={page}
            itemsPerPage={itemsPerPage}
            totalItems={totalItems}
            itemName="leads"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>
    </div>
  );
}

function CanalBadge({ canal }: { canal: string }) {
  const config: Record<string, { bg: string; color: string }> = {
    'Directo':      { bg: 'rgba(59,130,246,0.12)',   color: '#60A5FA' },
    'Agente':       { bg: 'rgba(168,85,247,0.12)',   color: '#C084FC' },
    'Telemarketing':{ bg: 'rgba(245,158,11,0.12)',   color: '#F59E0B' },
    'Partner':      { bg: 'rgba(34,197,94,0.12)',    color: '#22C55E' },
    'Online':       { bg: 'rgba(222,255,154,0.12)',  color: '#DEFF9A' },
  };
  const c = config[canal] || { bg: 'rgba(148,163,184,0.12)', color: '#94A3B8' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '99px',
      background: c.bg, color: c.color,
      fontSize: '0.72rem', fontWeight: 600,
    }}>
      {canal || 'S/D'}
    </span>
  );
}
