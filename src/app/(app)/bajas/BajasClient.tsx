'use client';

import React, { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/Topbar';
import PaginationFooter from '@/components/PaginationFooter';
import WinbackOfferModal from '@/components/bajas/WinbackOfferModal';
import {
  Search,
  TrendingDown,
  Zap,
  Calendar,
  Mail,
  Phone,
  MessageCircle,
  Send,
  FileText,
  Download,
  AlertTriangle,
  CheckSquare,
  Layers,
  Ban,
  FilePlus2,
  RotateCcw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  getPaginatedBajasAction,
  savePenaltyAction,
  bulkDiscardPenaltiesAction,
  bulkIssuePenaltiesAction,
} from '@/app/actions/bajasActions';
import type { BajasTabMode, BajasStatsSummary } from '@/lib/bajasServer';

export interface BajaData {
  id: string;
  tabMode?: BajasTabMode;
  contractCode?: string;
  cups: string;
  cupsRoot?: string;
  cliente: string;
  clientId: string;
  vatNumber?: string;
  telefono: string | null;
  email: string | null;
  invoiceEmail?: string | null;
  address?: string;
  tarifa: string;
  mwh: number;
  p1c?: number | null;
  p2c?: number | null;
  p3c?: number | null;
  p4c?: number | null;
  p5c?: number | null;
  p6c?: number | null;
  fechaAlta: string;
  fechaBaja: string;
  diasHastaBaja?: number | null;
  motivo: string;
  canal: string;
  comercial?: string;
  producto: string;
  permanenceMonths?: number;
  diasVida: number;
  hasSelfConsumption: boolean;
  bajaProcess?: string | null;
  isPreavisoBreached?: boolean;
  calculatedPenalty?: number;
  penalization?: number | null;
  penaltyStatus?: string;
  penaltyInvoiceNumber?: string | null;
  penaltyInvoicePdfUrl?: string | null;
  brandId?: string | null;
  brandName?: string;
  brandCode?: string;
  brandEmail?: string;
  brandPhone?: string;
  brandDomain?: string;
  brandAddress?: string;
  winbackStatus?: string | null;
  winbackNotes?: string | null;
  winbackLastContactAt?: string | null;
  winbackProductOffered?: string | null;
}

const getTariffStyle = (tarifa: string) => {
  const t = (tarifa || '').toUpperCase();
  if (t.includes('2.0'))
    return {
      background: 'rgba(59, 130, 246, 0.1)',
      color: '#60a5fa',
      border: '1px solid rgba(59, 130, 246, 0.2)',
    };
  if (t.includes('3.0'))
    return {
      background: 'rgba(168, 85, 247, 0.1)',
      color: '#c084fc',
      border: '1px solid rgba(168, 85, 247, 0.2)',
    };
  if (t.includes('6.'))
    return {
      background: 'rgba(245, 158, 11, 0.1)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.2)',
    };
  return {
    background: 'rgba(107, 114, 128, 0.1)',
    color: '#9ca3af',
    border: '1px solid rgba(107, 114, 128, 0.2)',
  };
};

const getWinbackBadge = (status?: string | null) => {
  switch (status) {
    case 'CONTACTADO':
      return {
        label: 'Contactado',
        style: {
          background: 'rgba(59, 130, 246, 0.12)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.25)',
        },
      };
    case 'OFERTA_ENVIADA':
      return {
        label: 'Oferta enviada',
        style: {
          background: 'rgba(168, 85, 247, 0.12)',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.25)',
        },
      };
    case 'EN_NEGOCIACION':
      return {
        label: 'En negociación',
        style: {
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        },
      };
    case 'RECUPERADO':
      return {
        label: 'Recuperado ✓',
        style: {
          background: 'rgba(16, 185, 129, 0.14)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        },
      };
    case 'DESCARTADO':
      return {
        label: 'No interesado',
        style: {
          background: 'rgba(107, 114, 128, 0.14)',
          color: '#9ca3af',
          border: '1px solid rgba(107, 114, 128, 0.25)',
        },
      };
    default:
      return null;
  }
};

export default function BajasClient({
  isBackofficeOrAdmin,
  initialBajas,
  initialTotalCount,
  initialConfirmadasCount = 0,
  initialPreavisoCount = 0,
  initialTotalPenaltySum = 0,
  initialStats,
  products = [],
  channels = [],
  origenBajaOptions = [],
  tarifaOptions = [],
}: {
  userRole?: string;
  isBackofficeOrAdmin: boolean;
  initialBajas: BajaData[];
  initialTotalCount: number;
  initialConfirmadasCount?: number;
  initialPreavisoCount?: number;
  initialTotalPenaltySum?: number;
  initialStats: BajasStatsSummary | null;
  products?: any[];
  channels?: any[];
  origenBajaOptions?: string[];
  tarifaOptions?: string[];
}) {
  const [tab, setTab] = useState<BajasTabMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('bajas_tab');
      if (saved === 'PREAVISO_PASO_11') return 'PREAVISO_PASO_11';
    }
    return 'CONFIRMADAS';
  });

  const [search, setSearch] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('bajas_search') || '' : ''
  );
  const [dateFrom, setDateFrom] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('bajas_dateFrom') || '' : ''
  );
  const [dateTo, setDateTo] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('bajas_dateTo') || '' : ''
  );
  const [tarifaFilter, setTarifaFilter] = useState<string[]>(tarifaOptions);
  const [canalFilter, setCanalFilter] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('bajas_canalFilter') || 'TODOS' : 'TODOS'
  );
  const [origenBajaFilter, setOrigenBajaFilter] = useState<string[]>(origenBajaOptions);
  const [penaltyFilter, setPenaltyFilter] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem('bajas_penaltyFilter') || 'TODOS'
      : 'TODOS'
  );
  const [winbackFilter, setWinbackFilter] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem('bajas_winbackFilter') || 'TODOS'
      : 'TODOS'
  );
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  const [isOrigenDropdownOpen, setIsOrigenDropdownOpen] = useState(false);
  const [isTarifaDropdownOpen, setIsTarifaDropdownOpen] = useState(false);
  const tarifaRef = useRef<HTMLDivElement>(null);
  const origenRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const [bajas, setBajas] = useState<BajaData[]>(initialBajas);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [confirmadasCount, setConfirmadasCount] = useState(initialConfirmadasCount);
  const [preavisoCount, setPreavisoCount] = useState(initialPreavisoCount);
  const [totalPenaltySum, setTotalPenaltySum] = useState(initialTotalPenaltySum || 0);
  const [stats, setStats] = useState<BajasStatsSummary | null>(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Modals
  const [offerModalData, setOfferModalData] = useState<BajaData | null>(null);
  const [penaltyModalData, setPenaltyModalData] = useState<BajaData | null>(null);
  const [editingPenalty, setEditingPenalty] = useState<string>('');
  const [savingPenalty, setSavingPenalty] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tarifaRef.current && !tarifaRef.current.contains(e.target as Node)) {
        setIsTarifaDropdownOpen(false);
      }
      if (origenRef.current && !origenRef.current.contains(e.target as Node)) {
        setIsOrigenDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('bajas_tab', tab);
    sessionStorage.setItem('bajas_search', search);
    sessionStorage.setItem('bajas_canalFilter', canalFilter);
    sessionStorage.setItem('bajas_dateFrom', dateFrom);
    sessionStorage.setItem('bajas_dateTo', dateTo);
    sessionStorage.setItem('bajas_penaltyFilter', penaltyFilter);
    sessionStorage.setItem('bajas_winbackFilter', winbackFilter);
  }, [tab, search, canalFilter, dateFrom, dateTo, penaltyFilter, winbackFilter]);

  useEffect(() => {
    if (penaltyModalData) {
      setEditingPenalty(
        penaltyModalData.penalization !== null && penaltyModalData.penalization !== undefined
          ? penaltyModalData.penalization.toFixed(2)
          : penaltyModalData.calculatedPenalty?.toFixed(2) || '0.00'
      );
    }
  }, [penaltyModalData]);

  const reloadBajas = async (overridePage?: number) => {
    setIsLoading(true);
    try {
      const targetPage = overridePage ?? page;
      const effectiveTarifas =
        tarifaFilter.length === tarifaOptions.length ? [] : tarifaFilter;
      const effectiveOrigenes =
        origenBajaFilter.length === origenBajaOptions.length ? [] : origenBajaFilter;

      if (tarifaFilter.length === 0 || origenBajaFilter.length === 0) {
        setBajas([]);
        setTotalCount(0);
        setTotalPenaltySum(0);
        if (isBackofficeOrAdmin) {
          setStats({
            totalBajas: 0,
            bajasEsteMes: 0,
            totalMwhPerdido: 0,
            avgDias: 0,
            avgClientDias: 0,
            totalPenaltySum: 0,
            pendingPenaltyCount: 0,
          });
        }
        return;
      }

      const result = await getPaginatedBajasAction(
        targetPage,
        itemsPerPage,
        search,
        'TODOS',
        canalFilter,
        effectiveOrigenes,
        dateFrom || null,
        dateTo || null,
        effectiveTarifas,
        {
          tab,
          penaltyFilter,
          winbackFilter,
        }
      );
      if (result.success) {
        setBajas((result.bajas || []) as BajaData[]);
        setTotalCount(result.totalCount || 0);
        if (result.confirmadasCount !== undefined) setConfirmadasCount(result.confirmadasCount);
        if (result.preavisoCount !== undefined) setPreavisoCount(result.preavisoCount);
        setTotalPenaltySum(result.totalPenaltySum || 0);
        if (result.stats) setStats(result.stats);
      }
    } catch (err) {
      console.error('Error fetching bajas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Skip redundant initial load only if all initial default states match SSR
    if (
      isFirstRender.current &&
      tab === 'CONFIRMADAS' &&
      page === 1 &&
      itemsPerPage === 100 &&
      search === '' &&
      canalFilter === 'TODOS' &&
      penaltyFilter === 'TODOS' &&
      winbackFilter === 'TODOS' &&
      !dateFrom &&
      !dateTo &&
      tarifaFilter.length === tarifaOptions.length &&
      origenBajaFilter.length === origenBajaOptions.length
    ) {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    const debounceId = setTimeout(() => {
      reloadBajas();
    }, 280);

    return () => clearTimeout(debounceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    page,
    itemsPerPage,
    search,
    canalFilter,
    origenBajaFilter,
    dateFrom,
    dateTo,
    tarifaFilter,
    penaltyFilter,
    winbackFilter,
  ]);

  const handleResetFilters = () => {
    setSearch('');
    setCanalFilter('TODOS');
    setDateFrom('');
    setDateTo('');
    setPenaltyFilter('TODOS');
    setWinbackFilter('TODOS');
    setTarifaFilter(tarifaOptions);
    setOrigenBajaFilter(origenBajaOptions);
    setSelectedIds(new Set());
    setPage(1);
  };

  const hasActiveFilters =
    search !== '' ||
    canalFilter !== 'TODOS' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    penaltyFilter !== 'TODOS' ||
    winbackFilter !== 'TODOS' ||
    tarifaFilter.length !== tarifaOptions.length ||
    origenBajaFilter.length !== origenBajaOptions.length;

  const toggleSelectAll = () => {
    if (selectedIds.size === bajas.length && bajas.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bajas.map((b) => b.id)));
    }
  };

  const toggleSelectOne = (id: string, idx: number, shiftKey: boolean) => {
    const next = new Set(selectedIds);
    if (shiftKey && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, idx);
      const end = Math.max(lastSelectedIdx, idx);
      for (let i = start; i <= end; i++) {
        if (bajas[i]) next.add(bajas[i].id);
      }
    } else {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    }
    setSelectedIds(next);
    setLastSelectedIdx(idx);
  };

  const handleSavePenalty = async (status: string, generatePdf: boolean = true) => {
    if (!penaltyModalData) return;
    setSavingPenalty(true);
    const val = parseFloat(editingPenalty);
    const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
    const result = await savePenaltyAction(penaltyModalData.id, cleanVal, status, generatePdf);
    setSavingPenalty(false);
    if (result.success) {
      setPenaltyModalData(null);
      if ((result as any).invoiceNumber) {
        setFeedbackBanner(`Factura ${(result as any).invoiceNumber} emitida correctamente.`);
        setTimeout(() => setFeedbackBanner(null), 5000);
      }
      await reloadBajas();
    } else {
      alert('Error guardando la penalización: ' + result.error);
    }
  };

  const handleBulkDiscard = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `¿Seguro que deseas descartar (0,00 € · No Cobrar) las ${selectedIds.size} bajas seleccionadas?`
      )
    )
      return;

    setBulkProcessing(true);
    const res = await bulkDiscardPenaltiesAction(Array.from(selectedIds));
    setBulkProcessing(false);
    if (res.success) {
      setFeedbackBanner(res.message || 'Penalizaciones descartadas.');
      setSelectedIds(new Set());
      setTimeout(() => setFeedbackBanner(null), 5000);
      await reloadBajas();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleBulkIssue = async (groupMultipointSinglePdf: boolean) => {
    if (selectedIds.size === 0) return;
    const modeDesc = groupMultipointSinglePdf
      ? 'agrupando en un único PDF multipunto los suministros del mismo CIF/Cliente'
      : 'emitiendo una factura individual por cada contrato seleccionado';
    if (
      !window.confirm(
        `¿Emitir facturas oficiales de penalización (+21% IVA) para la selección (${selectedIds.size} contratos), ${modeDesc}?`
      )
    )
      return;

    setBulkProcessing(true);
    const res = await bulkIssuePenaltiesAction(Array.from(selectedIds), groupMultipointSinglePdf);
    setBulkProcessing(false);
    if (res.success) {
      setFeedbackBanner(res.message || 'Facturas emitidas.');
      setSelectedIds(new Set());
      setTimeout(() => setFeedbackBanner(null), 6000);
      await reloadBajas();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleExportExcel = async () => {
    setExportingXlsx(true);
    try {
      const effectiveTarifas =
        tarifaFilter.length === tarifaOptions.length ? [] : tarifaFilter;
      const effectiveOrigenes =
        origenBajaFilter.length === origenBajaOptions.length ? [] : origenBajaFilter;

      const res = await fetch('/api/bajas/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab,
          search,
          canalFilter,
          origenBajaFilter: effectiveOrigenes,
          tarifaFilter: effectiveTarifas,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          penaltyFilter,
          winbackFilter,
          selectedIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        }),
      });

      if (!res.ok) throw new Error('Error exportando Excel');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        tab === 'PREAVISO_PASO_11'
          ? 'preavisos_paso11_retencion.xlsx'
          : 'bajas_confirmadas.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'No se pudo descargar el Excel');
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleTrackingUpdated = (
    contractId: string,
    tracking: {
      winbackStatus: string | null;
      winbackNotes: string | null;
      winbackLastContactAt: string | null;
      winbackProductOffered: string | null;
    }
  ) => {
    setBajas((prev) =>
      prev.map((row) => (row.id === contractId ? { ...row, ...tracking } : row))
    );
  };

  const showCheckboxes = isBackofficeOrAdmin && tab === 'CONFIRMADAS';
  const desktopColCount =
    8 + (showCheckboxes ? 1 : 0) + (isBackofficeOrAdmin ? 1 : 0);

  return (
    <>
      <Topbar
        title="Bajas y Retención"
        subtitle="Control de fugas ATR, alertas tempranas Paso 11, recuperación comercial y penalizaciones"
      />

      <div style={{ padding: '24px' }}>
        {/* Pestañas Operativas: Bajas Confirmadas vs Preaviso Paso 11 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '20px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTab('CONFIRMADAS');
                setSelectedIds(new Set());
                setPage(1);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: tab === 'CONFIRMADAS' ? 'var(--bg-base)' : 'transparent',
                color: tab === 'CONFIRMADAS' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow:
                  tab === 'CONFIRMADAS' ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
              }}
            >
              <TrendingDown size={15} color="#ef4444" />
              Bajas Confirmadas
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {confirmadasCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('PREAVISO_PASO_11');
                setSelectedIds(new Set());
                setPage(1);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: tab === 'PREAVISO_PASO_11' ? 'var(--bg-base)' : 'transparent',
                color:
                  tab === 'PREAVISO_PASO_11' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow:
                  tab === 'PREAVISO_PASO_11' ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
              }}
              title="Contratos aún ACTIVOS con solicitud de cambio/baja recibida (Paso 11 ATR) pendientes de fecha efectiva"
            >
              <AlertTriangle size={15} color="#f59e0b" />
              En Riesgo · Preaviso Paso 11
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {preavisoCount}
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {feedbackBanner && (
              <span
                style={{
                  fontSize: '0.8rem',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {feedbackBanner}
              </span>
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingXlsx}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              {exportingXlsx ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {selectedIds.size > 0
                ? `Exportar Selección (${selectedIds.size})`
                : 'Exportar Excel'}
            </button>
          </div>
        </div>

        {/* KPIs Superiores (Exclusivos Backoffice / Admin, sincronizados con filtros activos) */}
        {isBackofficeOrAdmin && stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {[
              {
                label:
                  tab === 'PREAVISO_PASO_11'
                    ? 'Salidas Previstas Mes'
                    : 'Bajas Este Mes',
                value: String(stats.bajasEsteMes || 0),
                color: 'var(--danger)',
                icon: TrendingDown,
              },
              {
                label:
                  tab === 'PREAVISO_PASO_11' ? 'MWh en Riesgo' : 'MWh Perdidos',
                value: `${(stats.totalMwhPerdido || 0).toLocaleString('es-ES', {
                  maximumFractionDigits: 0,
                })}`,
                color: 'var(--warning)',
                icon: Zap,
              },
              {
                label: 'Vida Media Contrato',
                value: `${stats.avgDias || 0}d`,
                color: 'var(--info)',
                icon: Calendar,
              },
              {
                label: 'Vida Media Cliente (CUPS)',
                value: `${stats.avgClientDias || 0}d`,
                color: 'var(--success)',
                icon: Calendar,
              },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {k.label}
                    </p>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: 'var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={15} color={k.color} />
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '2rem',
                      fontWeight: 800,
                      color: k.color,
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1,
                    }}
                  >
                    {k.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Barra de acciones masivas de penalizaciones */}
        {showCheckboxes && selectedIds.size > 0 && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 18px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckSquare size={16} color="#818cf8" />
              <strong>{selectedIds.size}</strong> contratos seleccionados
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="btn-ghost"
                style={{ fontSize: '0.75rem', padding: '2px 8px' }}
              >
                Deseleccionar
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={handleBulkDiscard}
                className="btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  color: '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ban size={14} />
                Descartar en bloque
              </button>
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={() => handleBulkIssue(false)}
                className="btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {bulkProcessing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileText size={14} />
                )}
                Facturar Individuales
              </button>
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={() => handleBulkIssue(true)}
                className="btn-primary"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Si un mismo CIF tiene varios CUPS seleccionados, genera 1 único PDF con todas las líneas (A26PENxxx-1, -2...)"
              >
                {bulkProcessing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Layers size={14} />
                )}
                Facturar Agrupando Multipunto (CIF)
              </button>
            </div>
          </div>
        )}

        {/* Tabla Principal */}
        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Buscador + Contador */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  className="form-input"
                  placeholder="Buscar por cliente, NIF/CIF, contrato o CUPS..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  style={{ paddingLeft: '32px', fontSize: '0.8rem', width: '100%' }}
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-ghost"
                  style={{
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <RotateCcw size={13} /> Limpiar filtros
                </button>
              )}
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {isLoading ? 'Cargando...' : `${totalCount} registros`}
              </div>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Tarifas */}
              <div ref={tarifaRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="form-input"
                  style={{
                    width: '165px',
                    fontSize: '0.78rem',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => setIsTarifaDropdownOpen(!isTarifaDropdownOpen)}
                >
                  <span>
                    Tarifas (
                    {tarifaFilter.length === tarifaOptions.length
                      ? 'Todas'
                      : tarifaFilter.length}
                    )
                  </span>
                  <TrendingDown size={13} style={{ color: 'var(--text-muted)' }} />
                </button>

                {isTarifaDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      width: '200px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      zIndex: 20,
                      padding: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        marginBottom: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={tarifaFilter.length === tarifaOptions.length}
                        onChange={(e) => {
                          setPage(1);
                          if (e.target.checked) setTarifaFilter(tarifaOptions);
                          else setTarifaFilter([]);
                        }}
                      />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        Seleccionar todas
                      </span>
                    </label>

                    {tarifaOptions.map((tarifa) => (
                      <label
                        key={tarifa}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={tarifaFilter.includes(tarifa)}
                          onChange={(e) => {
                            setPage(1);
                            if (e.target.checked) {
                              setTarifaFilter([...tarifaFilter, tarifa]);
                            } else {
                              setTarifaFilter(tarifaFilter.filter((t) => t !== tarifa));
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.78rem' }}>{tarifa}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Canales */}
              {isBackofficeOrAdmin && (
                <select
                  className="form-input"
                  value={canalFilter}
                  onChange={(e) => {
                    setCanalFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '175px', fontSize: '0.78rem' }}
                >
                  <option value="TODOS">Todos los canales</option>
                  {channels?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Orígenes ATR */}
              <div ref={origenRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="form-input"
                  style={{
                    width: '175px',
                    fontSize: '0.78rem',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => setIsOrigenDropdownOpen(!isOrigenDropdownOpen)}
                >
                  <span>
                    Orígenes (
                    {origenBajaFilter.length === origenBajaOptions.length
                      ? 'Todos'
                      : origenBajaFilter.length}
                    )
                  </span>
                  <TrendingDown size={13} style={{ color: 'var(--text-muted)' }} />
                </button>

                {isOrigenDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      width: '220px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      zIndex: 20,
                      padding: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        marginBottom: '4px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={origenBajaFilter.length === origenBajaOptions.length}
                        onChange={(e) => {
                          setPage(1);
                          if (e.target.checked) setOrigenBajaFilter(origenBajaOptions);
                          else setOrigenBajaFilter([]);
                        }}
                      />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        Seleccionar todos
                      </span>
                    </label>

                    {origenBajaOptions.map((origen) => (
                      <label
                        key={origen}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 6px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={origenBajaFilter.includes(origen)}
                          onChange={(e) => {
                            setPage(1);
                            if (e.target.checked) {
                              setOrigenBajaFilter([...origenBajaFilter, origen]);
                            } else {
                              setOrigenBajaFilter(
                                origenBajaFilter.filter((o) => o !== origen)
                              );
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.78rem' }}>{origen}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Estado Penalización (Solo Backoffice / Admin) */}
              {isBackofficeOrAdmin && (
                <select
                  className="form-input"
                  value={penaltyFilter}
                  onChange={(e) => {
                    setPenaltyFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '205px', fontSize: '0.78rem' }}
                >
                  <option value="TODOS">Penalización (Todas)</option>
                  <option value="PENDIENTE_CON_IMPORTE">Pendientes cobrables (&gt; 0 €)</option>
                  <option value="PENDIENTE">Pendientes (Todas)</option>
                  <option value="FACTURADA">Facturadas</option>
                  <option value="DESCARTADA">Descartadas</option>
                  <option value="SIN_PENALIZACION">Sin penalización (0 €)</option>
                </select>
              )}

              {/* Estado Winback (Todos los roles) */}
              <select
                className="form-input"
                value={winbackFilter}
                onChange={(e) => {
                  setWinbackFilter(e.target.value);
                  setPage(1);
                }}
                style={{ width: '185px', fontSize: '0.78rem' }}
              >
                <option value="TODOS">Recuperación (Todos)</option>
                <option value="SIN_GESTION">Sin gestión Winback</option>
                <option value="CONTACTADO">Contactado</option>
                <option value="OFERTA_ENVIADA">Oferta enviada</option>
                <option value="EN_NEGOCIACION">En negociación</option>
                <option value="RECUPERADO">Recuperado ✓</option>
                <option value="DESCARTADO">No interesado</option>
              </select>

              {/* Fechas */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Desde:</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ fontSize: '0.78rem', padding: '5px 8px', height: 'auto' }}
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Hasta:</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ fontSize: '0.78rem', padding: '5px 8px', height: 'auto' }}
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Vista Móvil (Cards) */}
          <div className="block md:hidden">
            {bajas.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: 'var(--text-muted)',
                }}
              >
                No se encontraron registros con los filtros aplicados.
              </div>
            ) : (
              bajas.map((b, index) => {
                const wb = getWinbackBadge(b.winbackStatus);
                return (
                  <div
                    key={b.id || `${b.cups}-${index}`}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <a
                          href={`/clientes/${b.clientId}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem',
                          }}
                          className="hover:text-amber-400 transition-colors"
                        >
                          {b.cliente}
                        </a>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          {b.vatNumber || ''} {b.telefono ? `· ${b.telefono}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {wb && (
                          <span className="badge" style={{ ...wb.style, fontSize: '0.68rem' }}>
                            {wb.label}
                          </span>
                        )}
                        <span
                          className="badge"
                          style={{ ...getTariffStyle(b.tarifa), fontSize: '0.72rem' }}
                        >
                          {b.tarifa}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {b.producto} · <strong>{b.mwh}</strong> MWh/año
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong>CUPS:</strong>{' '}
                      <a
                        href={`/contratos/${b.id}`}
                        className="hover:text-amber-500 hover:underline transition-colors font-mono"
                      >
                        {b.cups}
                      </a>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {b.contractCode}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ color: '#10b981' }}>Alta: {b.fechaAlta}</span>
                        <span style={{ color: 'var(--danger)' }}>
                          {tab === 'PREAVISO_PASO_11' ? 'Prevista:' : 'Baja:'} {b.fechaBaja}
                        </span>
                        {b.bajaProcess && (
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontSize: '0.65rem',
                            }}
                          >
                            {b.bajaProcess}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {b.telefono && (
                          <a
                            href={`tel:${b.telefono}`}
                            style={{
                              background: 'rgba(52, 211, 153, 0.1)',
                              color: '#34d399',
                              padding: '6px',
                              borderRadius: '6px',
                            }}
                            title="Llamar"
                          >
                            <Phone size={15} />
                          </a>
                        )}
                        {b.telefono && (
                          <a
                            href={`https://wa.me/${b.telefono.replace(/\s+/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: 'rgba(74, 222, 128, 0.1)',
                              color: '#4ade80',
                              padding: '6px',
                              borderRadius: '6px',
                            }}
                            title="WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </a>
                        )}
                        {b.email && (
                          <a
                            href={`mailto:${b.email}`}
                            style={{
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#60a5fa',
                              padding: '6px',
                              borderRadius: '6px',
                            }}
                            title="Enviar Email"
                          >
                            <Mail size={15} />
                          </a>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '10px',
                        borderTop: '1px dashed var(--border)',
                        gap: '8px',
                      }}
                    >
                      {isBackofficeOrAdmin ? (
                        <button
                          type="button"
                          className="badge hover:opacity-80 transition-opacity"
                          style={{
                            background:
                              b.penaltyStatus === 'FACTURADA'
                                ? 'rgba(52, 211, 153, 0.1)'
                                : b.penaltyStatus === 'DESCARTADA'
                                  ? 'rgba(107, 114, 128, 0.1)'
                                  : 'rgba(245, 158, 11, 0.1)',
                            color:
                              b.penaltyStatus === 'FACTURADA'
                                ? '#34d399'
                                : b.penaltyStatus === 'DESCARTADA'
                                  ? '#9ca3af'
                                  : '#fbbf24',
                            border: `1px solid ${
                              b.penaltyStatus === 'FACTURADA'
                                ? 'rgba(52, 211, 153, 0.2)'
                                : b.penaltyStatus === 'DESCARTADA'
                                  ? 'rgba(107, 114, 128, 0.2)'
                                  : 'rgba(245, 158, 11, 0.2)'
                            }`,
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPenaltyModalData(b)}
                        >
                          <FileText size={12} />
                          {b.penaltyStatus === 'DESCARTADA'
                            ? '0.00 € (Desc.)'
                            : b.penalization !== null && b.penalization !== undefined
                              ? `${b.penalization.toFixed(2)} €`
                              : b.calculatedPenalty
                                ? `${b.calculatedPenalty.toFixed(2)} € (Auto)`
                                : '0.00 €'}
                        </button>
                      ) : (
                        <span />
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a
                          href={`/leads?action=contract&cups=${encodeURIComponent(b.cups)}`}
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.73rem' }}
                          title="Pasar a Alta Luz"
                        >
                          <FilePlus2 size={13} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setOfferModalData(b)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', gap: 5 }}
                        >
                          <Send size={12} /> Recuperar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vista Escritorio (Tabla) */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {showCheckboxes && (
                    <th style={{ width: '38px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === bajas.length && bajas.length > 0}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th>CUPS</th>
                  <th>Cliente</th>
                  <th>Tarifa</th>
                  <th>MWh/año</th>
                  <th>Producto</th>
                  <th>Fecha Alta</th>
                  <th>
                    {tab === 'PREAVISO_PASO_11' ? 'Fecha Prevista Baja' : 'Fecha Baja'}
                  </th>
                  <th>Origen Baja</th>
                  {isBackofficeOrAdmin && (
                    <th style={{ minWidth: '145px' }}>
                      {tab === 'PREAVISO_PASO_11' ? 'Penaliz. Est.' : 'Penalización'}
                      <br />
                      <span
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          fontWeight: 'normal',
                        }}
                      >
                        (Total:{' '}
                        {totalPenaltySum.toLocaleString('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                        )
                      </span>
                    </th>
                  )}
                  <th style={{ textAlign: 'center' }}>Acciones de Recuperación</th>
                </tr>
              </thead>
              <tbody>
                {bajas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={desktopColCount}
                      style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No se encontraron registros con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  bajas.map((b, index) => {
                    const wb = getWinbackBadge(b.winbackStatus);
                    const isSelected = selectedIds.has(b.id);
                    return (
                      <tr
                        key={b.id || `${b.cups}-${index}`}
                        style={{
                          cursor: 'default',
                          background: isSelected ? 'rgba(99, 102, 241, 0.06)' : undefined,
                        }}
                      >
                        {showCheckboxes && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e: any) => {
                                e.stopPropagation();
                                toggleSelectOne(
                                  b.id,
                                  index,
                                  Boolean(e.nativeEvent?.shiftKey)
                                );
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td
                          className="mono-cell"
                          style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                        >
                          <a
                            href={`/contratos/${b.id}`}
                            className="hover:text-amber-500 hover:underline transition-colors"
                            title="Ver ficha del contrato"
                          >
                            {b.cups}
                          </a>
                          <div
                            style={{
                              fontSize: '0.65rem',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                            }}
                          >
                            {b.contractCode}
                          </div>
                        </td>
                        <td className="primary-cell">
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={`/clientes/${b.clientId}`}
                              className="hover:text-amber-400 hover:underline transition-colors"
                              title="Ver ficha del cliente"
                            >
                              {b.cliente}
                            </a>
                            <div className="flex items-center gap-2 flex-wrap">
                              {b.vatNumber && (
                                <span className="text-[11px] text-gray-500 font-mono">
                                  {b.vatNumber}
                                </span>
                              )}
                              {b.telefono && (
                                <span className="text-[11px] text-gray-400 font-mono">
                                  {b.telefono}
                                </span>
                              )}
                              {wb && (
                                <span
                                  className="badge"
                                  style={{ ...wb.style, fontSize: '0.62rem', padding: '1px 6px' }}
                                  title={
                                    b.winbackNotes
                                      ? `Notas: ${b.winbackNotes}`
                                      : wb.label
                                  }
                                >
                                  {wb.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={getTariffStyle(b.tarifa)}>
                            {b.tarifa}
                          </span>
                        </td>
                        <td>
                          <span
                            className="mono-cell"
                            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                          >
                            {b.mwh}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <div>{b.producto}</div>
                          {b.permanenceMonths === 0 && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              Sin permanencia
                            </span>
                          )}
                        </td>
                        <td
                          className="mono-cell"
                          style={{ fontSize: '0.78rem', color: '#10b981' }}
                        >
                          {b.fechaAlta}
                        </td>
                        <td
                          className="mono-cell"
                          style={{
                            fontSize: '0.78rem',
                            color:
                              tab === 'PREAVISO_PASO_11' ? '#fbbf24' : 'var(--danger)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>{b.fechaBaja}</span>
                            {tab === 'PREAVISO_PASO_11' &&
                              b.diasHastaBaja !== null &&
                              b.diasHastaBaja !== undefined && (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.64rem',
                                    padding: '1px 6px',
                                    background:
                                      b.diasHastaBaja <= 5
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : 'rgba(245, 158, 11, 0.15)',
                                    color: b.diasHastaBaja <= 5 ? '#f87171' : '#fbbf24',
                                  }}
                                >
                                  {b.diasHastaBaja >= 0
                                    ? `en ${b.diasHastaBaja}d`
                                    : `${Math.abs(b.diasHastaBaja)}d venc.`}
                                </span>
                              )}
                            {b.isPreavisoBreached && (
                              <span
                                title="Baja dentro de los últimos 30 días previos al vencimiento anual (incumplimiento de preaviso de 1 mes en suministro no residencial)"
                                style={{
                                  color: '#f59e0b',
                                  fontSize: '0.95rem',
                                  lineHeight: 1,
                                  cursor: 'help',
                                }}
                              >
                                ⚠️
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {b.bajaProcess ? (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                fontSize: '0.72rem',
                              }}
                            >
                              {b.bajaProcess}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>

                        {isBackofficeOrAdmin && (
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="badge hover:opacity-80 transition-opacity"
                                style={{
                                  background:
                                    b.penaltyStatus === 'FACTURADA'
                                      ? 'rgba(52, 211, 153, 0.1)'
                                      : b.penaltyStatus === 'DESCARTADA'
                                        ? 'rgba(107, 114, 128, 0.1)'
                                        : 'rgba(245, 158, 11, 0.1)',
                                  color:
                                    b.penaltyStatus === 'FACTURADA'
                                      ? '#34d399'
                                      : b.penaltyStatus === 'DESCARTADA'
                                        ? '#9ca3af'
                                        : '#fbbf24',
                                  border: `1px solid ${
                                    b.penaltyStatus === 'FACTURADA'
                                      ? 'rgba(52, 211, 153, 0.2)'
                                      : b.penaltyStatus === 'DESCARTADA'
                                        ? 'rgba(107, 114, 128, 0.2)'
                                        : 'rgba(245, 158, 11, 0.2)'
                                  }`,
                                  fontSize: '0.74rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setPenaltyModalData(b)}
                                title={
                                  b.penaltyInvoiceNumber
                                    ? `Factura: ${b.penaltyInvoiceNumber}`
                                    : 'Gestionar Penalización'
                                }
                              >
                                <FileText size={12} />
                                {b.penaltyStatus === 'DESCARTADA'
                                  ? '0.00 € (Desc.)'
                                  : b.penalization !== null && b.penalization !== undefined
                                    ? `${b.penalization.toFixed(2)} €`
                                    : b.calculatedPenalty
                                      ? `${b.calculatedPenalty.toFixed(2)} € (Auto)`
                                      : '0.00 €'}
                              </button>
                              {b.penaltyInvoicePdfUrl && (
                                <a
                                  href={b.penaltyInvoicePdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300"
                                  title={`Abrir PDF ${b.penaltyInvoiceNumber || ''}`}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>
                        )}

                        <td>
                          <div className="flex items-center justify-center gap-1.5">
                            {b.telefono && (
                              <a
                                href={`tel:${b.telefono}`}
                                className="btn-ghost text-emerald-400 hover:text-emerald-300"
                                style={{ padding: '5px' }}
                                title="Llamar"
                              >
                                <Phone size={14} />
                              </a>
                            )}
                            {b.telefono && (
                              <a
                                href={`https://wa.me/${b.telefono.replace(/\s+/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost text-green-400 hover:text-green-300"
                                style={{ padding: '5px' }}
                                title="WhatsApp"
                              >
                                <MessageCircle size={14} />
                              </a>
                            )}
                            {b.email && (
                              <a
                                href={`mailto:${b.email}`}
                                className="btn-ghost text-blue-400 hover:text-blue-300"
                                style={{ padding: '5px' }}
                                title={`Enviar email a ${b.email}`}
                              >
                                <Mail size={14} />
                              </a>
                            )}
                            <a
                              href={`/leads?action=contract&cups=${encodeURIComponent(b.cups)}`}
                              className="btn-ghost text-lime-400 hover:text-lime-300"
                              style={{ padding: '5px' }}
                              title="Pasar a Alta Luz en Leads (Auto-SIPS)"
                            >
                              <FilePlus2 size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => setOfferModalData(b)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', gap: 4 }}
                            >
                              <Send size={12} /> Recuperar
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
            totalItems={totalCount}
            itemName={tab === 'PREAVISO_PASO_11' ? 'preavisos' : 'bajas'}
            onPageChange={setPage}
            onItemsPerPageChange={(val) => {
              setItemsPerPage(val);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Modal Winback / Recuperación */}
      {offerModalData && (
        <WinbackOfferModal
          baja={offerModalData}
          products={products}
          onClose={() => setOfferModalData(null)}
          onTrackingUpdated={handleTrackingUpdated}
        />
      )}

      {/* Modal Gestión de Penalización */}
      {penaltyModalData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="card" style={{ width: '440px', maxWidth: '100%', padding: '24px' }}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: '14px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileText size={20} />
              Gestionar Penalización
            </h3>

            <div
              style={{
                marginBottom: '14px',
                padding: '12px',
                background: 'var(--bg-elevated)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                Cálculo Automático ERP (Base Imponible · IVA 21% aparte)
              </div>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {penaltyModalData.calculatedPenalty
                  ? penaltyModalData.calculatedPenalty.toFixed(2)
                  : '0.00'}{' '}
                €
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    marginLeft: '8px',
                  }}
                >
                  (Total c/IVA:{' '}
                  {((penaltyModalData.calculatedPenalty || 0) * 1.21).toFixed(2)} €)
                </span>
              </div>
              {penaltyModalData.penaltyInvoiceNumber && (
                <div style={{ marginTop: '6px', fontSize: '0.76rem', color: '#34d399' }}>
                  Factura emitida: <strong>{penaltyModalData.penaltyInvoiceNumber}</strong>
                  {penaltyModalData.penaltyInvoicePdfUrl && (
                    <>
                      {' · '}
                      <a
                        href={penaltyModalData.penaltyInvoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Ver PDF
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>

            {penaltyModalData.tabMode === 'PREAVISO_PASO_11' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.78rem',
                  color: '#fbbf24',
                }}
              >
                Este contrato sigue ACTIVO en Preaviso Paso 11. Puedes dejar pre-ajustado el
                importe o descartarla, pero solo debe facturarse una vez consumada la baja.
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--text-secondary)',
                }}
              >
                Penalización a Aplicar (Base Imponible en €)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                style={{
                  width: '100%',
                  fontSize: '1rem',
                  padding: '10px',
                  opacity: penaltyModalData.penaltyStatus === 'FACTURADA' ? 0.6 : 1,
                }}
                value={editingPenalty}
                onChange={(e) => setEditingPenalty(e.target.value)}
                disabled={penaltyModalData.penaltyStatus === 'FACTURADA'}
              />
              <div
                style={{
                  fontSize: '0.74rem',
                  color:
                    penaltyModalData.penaltyStatus === 'FACTURADA'
                      ? '#10b981'
                      : 'var(--text-muted)',
                  marginTop: '6px',
                }}
              >
                {penaltyModalData.penaltyStatus === 'FACTURADA'
                  ? 'Esta penalización ya ha sido facturada. Para modificarla o anularla acude a Facturas de Penalizaciones.'
                  : `Total final con IVA (21%): ${((parseFloat(editingPenalty) || 0) * 1.21).toFixed(2)} €`}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPenaltyModalData(null)}
                disabled={savingPenalty}
              >
                {penaltyModalData.penaltyStatus === 'FACTURADA' ? 'Cerrar' : 'Cancelar'}
              </button>

              {penaltyModalData.penaltyStatus !== 'FACTURADA' && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleSavePenalty('PENDIENTE', false)}
                    disabled={savingPenalty}
                    title="Guardar importe manual dejándola en estado Pendiente"
                  >
                    Guardar Pendiente
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      color: '#ef4444',
                      borderColor: 'rgba(239, 68, 68, 0.25)',
                      background: 'rgba(239, 68, 68, 0.06)',
                    }}
                    onClick={() => handleSavePenalty('DESCARTADA', false)}
                    disabled={savingPenalty}
                  >
                    Descartar (0 €)
                  </button>
                  {penaltyModalData.tabMode !== 'PREAVISO_PASO_11' && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          color: '#10b981',
                          borderColor: 'rgba(16, 185, 129, 0.25)',
                          background: 'rgba(16, 185, 129, 0.06)',
                        }}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Si marcas esta penalización como facturada externamente, se guardará el estado pero NO se emitirá un PDF en el sistema. ¿Continuar?'
                            )
                          ) {
                            handleSavePenalty('FACTURADA', false);
                          }
                        }}
                        disabled={savingPenalty}
                      >
                        Facturada Externa
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleSavePenalty('FACTURADA', true)}
                        disabled={
                          savingPenalty || (parseFloat(editingPenalty) || 0) <= 0
                        }
                      >
                        {savingPenalty ? 'Emitiendo...' : 'Confirmar y Emitir PDF'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
