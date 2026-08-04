'use client';

import { useState, useMemo, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { Search, TrendingDown, Zap, ExternalLink, Calendar , Mail} from 'lucide-react';
import PaginationFooter from '@/components/PaginationFooter';

const motivos = ['Cese de actividad', 'Cambio de comercializadora', 'Venta del inmueble', 'Impago', 'Solicitud cliente', 'Fin de permanencia'];

export interface BajaData {
  id: string; // Contract ID
  contractCode?: string;
  cups: string;
  cliente: string;
  clientId: string;
  telefono: string | null;
  email: string | null;
  tarifa: string;
  mwh: number;
  fechaAlta: string;
  fechaBaja: string;
  motivo: string;
  canal: string;
  producto: string;
  diasVida: number;
  hasSelfConsumption: boolean;
  bajaProcess?: string | null;
  calculatedPenalty?: number;
  penalization?: number | null;
  penaltyStatus?: string;
}

import WinbackOfferModal from '@/components/bajas/WinbackOfferModal';
import { Phone, MessageCircle, Send, FileText } from 'lucide-react';
import { getPaginatedBajasAction, savePenaltyAction } from '@/app/actions/bajasActions';

const getTariffStyle = (tarifa: string) => {
  const t = tarifa.toUpperCase();
  if (t.includes('2.0')) return { background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' };
  if (t.includes('3.0')) return { background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' };
  if (t.includes('6.')) return { background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' };
  return { background: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.2)' };
};

const tarifaOptions = ['2.0TD', '3.0TD', '6.1TD', '6.2TD', '6.3TD', '6.4TD', '3.0TDVE', '6.1TDVE'];

export default function BajasClient({ initialBajas, initialTotalCount, initialTotalPenaltySum, initialStats, products = [], channels = [], origenBajaOptions = [] }: { initialBajas: BajaData[], initialTotalCount: number, initialTotalPenaltySum?: number, initialStats: any, products?: any[], channels?: any[], origenBajaOptions?: string[] }) {
  const [search, setSearch] = useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('bajas_search') || '' : '');
  const [dateFrom, setDateFrom] = useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('bajas_dateFrom') || '' : '');
  const [dateTo, setDateTo] = useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('bajas_dateTo') || '' : '');
  const [tarifaFilter, setTarifaFilter] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bajas_tarifaFilter');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          return tarifaOptions;
        }
      }
    }
    return tarifaOptions;
  });
  const [motivoFilter, setMotivoFilter] = useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('bajas_motivoFilter') || 'TODOS' : 'TODOS');
  const [canalFilter, setCanalFilter] = useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('bajas_canalFilter') || 'TODOS' : 'TODOS');
  const [origenBajaFilter, setOrigenBajaFilter] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bajas_origenFilter');
      if (stored) return JSON.parse(stored);
    }
    return origenBajaOptions; // By default, select all
  });
  const [page, setPage] = useState(() => typeof window !== 'undefined' ? Number(sessionStorage.getItem('bajas_page')) || 1 : 1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  useEffect(() => {
    sessionStorage.setItem('bajas_search', search);
    sessionStorage.setItem('bajas_motivoFilter', motivoFilter);
    sessionStorage.setItem('bajas_canalFilter', canalFilter);
    sessionStorage.setItem('bajas_origenFilter', JSON.stringify(origenBajaFilter));
    sessionStorage.setItem('bajas_page', page.toString());
    sessionStorage.setItem('bajas_dateFrom', dateFrom);
    sessionStorage.setItem('bajas_dateTo', dateTo);
    sessionStorage.setItem('bajas_tarifaFilter', JSON.stringify(tarifaFilter));
  }, [search, motivoFilter, canalFilter, origenBajaFilter, page, dateFrom, dateTo, tarifaFilter]);
  const [offerModalData, setOfferModalData] = useState<BajaData | null>(null);
  
  const [isOrigenDropdownOpen, setIsOrigenDropdownOpen] = useState(false);
  const [isTarifaDropdownOpen, setIsTarifaDropdownOpen] = useState(false);

  const [bajas, setBajas] = useState<BajaData[]>(initialBajas);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [totalPenaltySum, setTotalPenaltySum] = useState(initialTotalPenaltySum || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [penaltyModalData, setPenaltyModalData] = useState<BajaData | null>(null);
  const [editingPenalty, setEditingPenalty] = useState<string>('');
  const [savingPenalty, setSavingPenalty] = useState(false);

  useEffect(() => {
    if (penaltyModalData) {
      setEditingPenalty(
        penaltyModalData.penalization !== null && penaltyModalData.penalization !== undefined
          ? penaltyModalData.penalization.toFixed(2)
          : penaltyModalData.calculatedPenalty?.toFixed(2) || '0.00'
      );
    }
  }, [penaltyModalData]);

  const handleSavePenalty = async (status: string) => {
    if (!penaltyModalData) return;
    setSavingPenalty(true);
    const val = parseFloat(editingPenalty);
    const result = await savePenaltyAction(penaltyModalData.id, isNaN(val) ? 0 : val, status);
    if (result.success) {
      // Update local state
      setBajas(prev => prev.map(b => b.id === penaltyModalData.id ? { ...b, penalization: isNaN(val) ? 0 : val, penaltyStatus: status } : b));
      setPenaltyModalData(null);
    } else {
      alert('Error guardando la penalización: ' + result.error);
    }
    setSavingPenalty(false);
  };

  useEffect(() => {
    if (page === 1 && itemsPerPage === 100 && search === '' && motivoFilter === 'TODOS' && canalFilter === 'TODOS' && tarifaFilter.length === tarifaOptions.length && origenBajaFilter.length === origenBajaOptions.length && !dateFrom && !dateTo) return;

    const fetchBajas = async () => {
      setIsLoading(true);
      try {
        const result = await getPaginatedBajasAction(page, itemsPerPage, search, motivoFilter, canalFilter, origenBajaFilter, dateFrom || null, dateTo || null, tarifaFilter);
        if (result.success && result.bajas) {
          setBajas(result.bajas as BajaData[]);
          setTotalCount(result.totalCount || 0);
          setTotalPenaltySum(result.totalPenaltySum || 0);
        }
      } catch (err) {
        console.error("Error fetching bajas:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceId = setTimeout(() => {
      fetchBajas();
    }, 300);

    return () => clearTimeout(debounceId);
  }, [page, itemsPerPage, search, motivoFilter, canalFilter, origenBajaFilter, dateFrom, dateTo, tarifaFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, motivoFilter, canalFilter, origenBajaFilter, dateFrom, dateTo, tarifaFilter]);

  return (
    <>
      <Topbar title="Bajas" subtitle="Contratos cancelados · Histórico para recuperación de cartera" />

      <div style={{ padding: '24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Bajas Este Mes',      value: String(initialStats?.bajasEsteMes || 0), color: 'var(--danger)',  icon: TrendingDown },
            { label: 'MWh Perdidos',        value: `${(initialStats?.totalMwhPerdido || 0).toFixed(0)}`, color: 'var(--warning)', icon: Zap },
            { label: 'Vida Media Contrato', value: `${initialStats?.avgDias || 0}d`, color: 'var(--info)',    icon: Calendar },
            { label: 'Vida Media Cliente',  value: `${initialStats?.avgClientDias || 0}d`, color: 'var(--success)', icon: Calendar },
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
              </div>
            );
          })}
        </div>



        {/* Table */}
        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Fila principal: Buscador */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-input" placeholder="Buscar cliente o CUPS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem', width: '100%' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                {totalCount} bajas
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button 
                  className="form-input" 
                  style={{ width: '180px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => setIsTarifaDropdownOpen(!isTarifaDropdownOpen)}
                >
                  <span>Tarifas ({tarifaFilter.length === tarifaOptions.length ? 'Todas' : tarifaFilter.length})</span>
                  <TrendingDown size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
                
                {isTarifaDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', left: 0, marginTop: '4px', width: '200px', 
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, padding: '8px',
                    maxHeight: '300px', overflowY: 'auto'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                      <input 
                        type="checkbox" 
                        checked={tarifaFilter.length === tarifaOptions.length}
                        onChange={(e) => {
                          if (e.target.checked) setTarifaFilter(tarifaOptions);
                          else setTarifaFilter([]);
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Seleccionar todas</span>
                    </label>
                    
                    {tarifaOptions.map(tarifa => (
                      <label key={tarifa} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={tarifaFilter.includes(tarifa)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTarifaFilter([...tarifaFilter, tarifa]);
                            } else {
                              setTarifaFilter(tarifaFilter.filter(t => t !== tarifa));
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>{tarifa}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <select
                className="form-input"
                value={canalFilter}
                onChange={(e) => setCanalFilter(e.target.value)}
                style={{ width: '200px', fontSize: '0.8rem' }}
              >
                <option value="TODOS">Todos los canales</option>
                {channels?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <div style={{ position: 'relative' }}>
                <button 
                  className="form-input" 
                  style={{ width: '200px', fontSize: '0.8rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => setIsOrigenDropdownOpen(!isOrigenDropdownOpen)}
                >
                  <span>Orígenes ({origenBajaFilter.length === origenBajaOptions.length ? 'Todos' : origenBajaFilter.length})</span>
                  <TrendingDown size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
                
                {isOrigenDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', left: 0, marginTop: '4px', width: '220px', 
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, padding: '8px',
                    maxHeight: '300px', overflowY: 'auto'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                      <input 
                        type="checkbox" 
                        checked={origenBajaFilter.length === origenBajaOptions.length}
                        onChange={(e) => {
                          if (e.target.checked) setOrigenBajaFilter(origenBajaOptions);
                          else setOrigenBajaFilter([]);
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Seleccionar todos</span>
                    </label>
                    
                    {origenBajaOptions.map(origen => (
                      <label key={origen} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={origenBajaFilter.includes(origen)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOrigenBajaFilter([...origenBajaFilter, origen]);
                            } else {
                              setOrigenBajaFilter(origenBajaFilter.filter(o => o !== origen));
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>{origen}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Desde:</span>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ fontSize: '0.8rem', padding: '6px 10px', height: 'auto' }}
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hasta:</span>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ fontSize: '0.8rem', padding: '6px 10px', height: 'auto' }}
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {bajas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No se encontraron bajas con los filtros aplicados.
              </div>
            ) : (
              bajas.map((b, index) => (
                <div key={b.id || `${b.cups}-${index}`} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{b.cliente}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{b.telefono || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ ...getTariffStyle(b.tarifa), fontSize: '0.72rem' }}>{b.tarifa}</span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {b.producto}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Consumo:</strong> {b.mwh} MWh/año
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>CUPS:</strong> <a href={`/contratos/${b.id}`} className="hover:text-amber-500 hover:underline transition-colors">{b.cups}</a>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.contractCode}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#10b981' }}>Alta: {b.fechaAlta}</span>
                      <span style={{ color: 'var(--danger)' }}>Baja: {b.fechaBaja}</span>
                      {b.bajaProcess && <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.65rem' }}>{b.bajaProcess}</span>}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {b.telefono && (
                        <a href={`tel:${b.telefono}`} className="action-icon" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '6px', borderRadius: '6px' }} title="Llamar">
                          <Phone size={16} />
                        </a>
                      )}
                      {b.telefono && (
                        <a href={`https://wa.me/${b.telefono.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="action-icon" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '6px', borderRadius: '6px' }} title="WhatsApp">
                          <MessageCircle size={16} />
                        </a>
                      )}
                      {b.email && (
                        <a href={`mailto:${b.email}`} className="action-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '6px', borderRadius: '6px' }} title="Enviar Email">
                          <Mail size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Cliente</th>
                  <th>Tarifa</th>
                  <th>MWh/año</th>
                  <th>Producto</th>
                  <th>Fecha Alta</th>
                  <th>Fecha Baja</th>
                  <th>Origen Baja</th>
                  <th style={{ minWidth: '130px' }}>
                    Penalización<br />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      (Total: {totalPenaltySum.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})
                    </span>
                  </th>
                  <th style={{ textAlign: 'center' }}>Acciones de Recuperación</th>
                </tr>
              </thead>
              <tbody>
                {bajas.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      No se encontraron bajas con los filtros aplicados.
                    </td>
                  </tr>
                ) : bajas.map((b, index) => (
                  <tr key={b.id || `${b.cups}-${index}`} style={{ cursor: 'default' }}>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <a href={`/contratos/${b.id}`} className="hover:text-amber-500 hover:underline transition-colors" title="Ver detalle del contrato">
                        {b.cups}
                      </a>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{b.contractCode}</div>
                    </td>
                    <td className="primary-cell">
                      <div className="flex flex-col">
                        <span>{b.cliente}</span>
                        {b.telefono && <span className="text-xs text-gray-500 font-mono">{b.telefono}</span>}
                      </div>
                    </td>
                    <td><span className="badge" style={getTariffStyle(b.tarifa)}>{b.tarifa}</span></td>
                    <td><span className="mono-cell" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.mwh}</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{b.producto}</td>
                    <td className="mono-cell" style={{ fontSize: '0.78rem', color: '#10b981' }}>{b.fechaAlta}</td>
                    <td className="mono-cell" style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{b.fechaBaja}</td>
                    <td>
                      {b.bajaProcess ? (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.72rem' }}>{b.bajaProcess}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="badge hover:opacity-80 transition-opacity"
                        style={{ 
                          background: b.penaltyStatus === 'FACTURADA' ? 'rgba(52, 211, 153, 0.1)' : b.penaltyStatus === 'DESCARTADA' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: b.penaltyStatus === 'FACTURADA' ? '#34d399' : b.penaltyStatus === 'DESCARTADA' ? '#9ca3af' : '#fbbf24',
                          border: `1px solid ${b.penaltyStatus === 'FACTURADA' ? 'rgba(52, 211, 153, 0.2)' : b.penaltyStatus === 'DESCARTADA' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                        onClick={() => setPenaltyModalData(b)}
                        title="Gestionar Penalización"
                      >
                        <FileText size={12} />
                        {b.penalization !== null && b.penalization !== undefined 
                          ? `${b.penalization.toFixed(2)} €` 
                          : b.calculatedPenalty ? `${b.calculatedPenalty.toFixed(2)} € (Auto)` : '0.00 €'}
                      </button>
                    </td>

                    <td>
                      <div className="flex items-center justify-center gap-2">
                        {b.telefono && (
                          <a href={`tel:${b.telefono}`} className="btn-ghost text-emerald-400 hover:text-emerald-300" style={{ padding: '6px' }} title="Llamar">
                            <Phone size={14} />
                          </a>
                        )}
                        {b.telefono && (
                          <a href={`https://wa.me/${b.telefono.replace(/\s+/g, '')}`} target="_blank" rel="noreferrer" className="btn-ghost text-green-400 hover:text-green-300" style={{ padding: '6px' }} title="WhatsApp">
                            <MessageCircle size={14} />
                          </a>
                        )}
                        <button onClick={() => setOfferModalData(b)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', gap: 4 }}>
                          <Send size={12} /> Recuperar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationFooter
            currentPage={page}
            itemsPerPage={itemsPerPage}
            totalItems={totalCount}
            itemName="bajas"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>
      
      {offerModalData && (
        <WinbackOfferModal 
          baja={offerModalData} 
          products={products}
          onClose={() => setOfferModalData(null)}
        />
      )}

      {penaltyModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} />
              Gestionar Penalización
            </h3>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cálculo Automático ERP</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {penaltyModalData.calculatedPenalty ? penaltyModalData.calculatedPenalty.toFixed(2) : '0.00'} €
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Penalización a Aplicar (€)
              </label>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                style={{ width: '100%', fontSize: '1rem', padding: '10px' }}
                value={editingPenalty}
                onChange={e => setEditingPenalty(e.target.value)}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Puedes ajustar manualmente el importe antes de confirmarlo.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setPenaltyModalData(null)}
                disabled={savingPenalty}
              >
                Cancelar
              </button>
              <button 
                className="btn-secondary" 
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
                onClick={() => handleSavePenalty('DESCARTADA')}
                disabled={savingPenalty}
              >
                Descartar (No Cobrar)
              </button>
              <button 
                className="btn-primary" 
                onClick={() => handleSavePenalty('FACTURADA')}
                disabled={savingPenalty}
              >
                {savingPenalty ? 'Guardando...' : 'Confirmar y Facturar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
