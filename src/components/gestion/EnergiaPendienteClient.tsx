'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Download,
  Search,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Building2,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ClosureHistoryItem {
  cierre: string;
  rank: number;
  days: number;
  liquidatedMwh: number;
  cadCostEur: number;
}

interface MonthlyDetails {
  lossRatio?: number;
  omieAvg?: number;
  restriccionesAvg?: number;
  osAvg?: number | null;
  weightedMarketPrice?: number;
  resSource?: 'COMPODEM' | 'REGANECU_CAD' | 'FALLBACK';
  priceFallbackUsed?: boolean;
  internalInvoicedMwh?: number;
  closureHistory?: ClosureHistoryItem[];
  tariffBreakdown?: Record<string, { rawMwh: number; bcMwh: number }>;
}

interface MonthlyData {
  month: string;
  cierre: string;
  estimatedBcMwh: number;
  liquidatedMwh: number;
  pendingMwh: number;
  estimatedPendingCostEur: number;
  invoicedMwh?: number;
  rawCchMwh?: number;
  surplusMwh?: number;
  f1UnbilledMwh?: number;
  lossRatio?: number;
  marketPrice?: number;
  cchDays?: number;
  reganecuDays?: number;
  daysInMonth?: number;
  updatedAt?: string;
  details?: MonthlyDetails;
}

interface DistributorAuditRow {
  distributor: string;
  activeCups: number;
  cupsWithCch: number;
  cupsMissingCch: number;
  billedMwh: number;
  unbilledF1Mwh: number;
  cchMwh: number;
  surplusMwh: number;
  gapMwh: number;
}

interface CupsDiscrepancyRow {
  supplyPointId: string;
  cups: string;
  clientName: string;
  tariff: string;
  distributor: string;
  cchDays: number;
  provisionalDays: number;
  billedMwh: number;
  unbilledF1Mwh: number;
  cchMwh: number;
  surplusMwh: number;
  gapMwh: number;
  statusTag: 'SIN_CCH' | 'CCH_INCOMPLETA' | 'FACTURADO_MAYOR' | 'CCH_MAYOR' | 'SIN_FACTURAR' | 'OK';
}

interface MonthlyAuditResponse {
  success: boolean;
  month: string;
  daysInMonth: number;
  summary: MonthlyData | null;
  quality: {
    activeCupsCount: number;
    activeCupsWithCch: number;
    activeCupsMissingCch: number;
    totalDefinitiveCurveDays: number;
    totalProvisionalCurveDays: number;
    unassignedBilledMwh: number;
  };
  byDistributor: DistributorAuditRow[];
  topCupsDiscrepancies: CupsDiscrepancyRow[];
}

function getClosureNumber(cierre: string): number {
  if (!cierre || cierre === 'N/A') return 0;
  const primary = cierre.split('/')[0].trim().toUpperCase();
  const m = primary.match(/^[AC](\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function isMatureClosure(cierre: string): boolean {
  return getClosureNumber(cierre) >= 4;
}

function isDefinitiveClosure(cierre: string): boolean {
  if (!cierre || cierre === 'N/A') return false;
  const primary = cierre.split('/')[0].trim().toUpperCase();
  return primary.startsWith('C');
}

export default function EnergiaPendienteClient() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [rebuildAggregates, setRebuildAggregates] = useState(false);
  const [monthsRange, setMonthsRange] = useState<number>(12);
  const [progressMsg, setProgressMsg] = useState<string>('');

  // Estado del modal de auditoría mensual
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<MonthlyAuditResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTab, setAuditTab] = useState<'resumen' | 'distribuidoras' | 'cups'>('cups');
  const [cupsSearch, setCupsSearch] = useState('');

  const loadData = useCallback(async (months: number = monthsRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gestion/energia-pendiente?months=${months}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Error desconocido al cargar los datos.');
      } else {
        setData(json.data || []);
        if (json.company?.name) setCompanyName(json.company.name);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [monthsRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openMonthAudit = async (month: string) => {
    setSelectedMonth(month);
    setAuditLoading(true);
    setAuditData(null);
    setCupsSearch('');
    try {
      const res = await fetch(`/api/gestion/energia-pendiente/${month}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || 'No se pudo cargar el desglose mensual');
      } else {
        setAuditData(json);
      }
    } catch (err: any) {
      toast.error('Error cargando auditoría: ' + err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  const formatMwh = (val: number) =>
    val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatEur = (val: number) =>
    val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const computedRows = useMemo(() => {
    return data.map((row) => {
      const invoicedMwh = row.invoicedMwh || 0;
      const surplusMwh = row.surplusMwh || 0;
      const lossRatio = row.lossRatio || 1.15;
      // Restamos el excedente solar vertido (1.0x según P.O. 14.8) para comparar homogéneamente con Demanda BC CCH neta
      const demandaBcEstimada = Math.max(0, invoicedMwh * lossRatio - surplusMwh);
      const demandaBcCch = row.estimatedBcMwh || 0;
      const descuadre = demandaBcEstimada - demandaBcCch;
      const avgPrice = row.marketPrice || 75;
      const energiaPteEstimada = row.pendingMwh + descuadre;
      const bImpPteEstimada = row.estimatedPendingCostEur + descuadre * avgPrice;
      const mature = isMatureClosure(row.cierre);

      const daysInMonth = row.daysInMonth || 30;
      const cchDays = row.cchDays ?? daysInMonth;
      const reganecuDays = row.reganecuDays ?? (row.cierre !== 'N/A' ? daysInMonth : 0);

      return {
        ...row,
        invoicedMwh,
        surplusMwh,
        lossRatio,
        demandaBcEstimada,
        demandaBcCch,
        descuadre,
        avgPrice,
        energiaPteEstimada,
        bImpPteEstimada,
        mature,
        daysInMonth,
        cchDays,
        reganecuDays,
      };
    });
  }, [data]);

  const totals = useMemo(() => {
    let invoicedMwh = 0;
    let demandaBcEstimada = 0;
    let demandaBcCch = 0;
    let descuadre = 0;
    let liquidatedMwh = 0;
    let pendingMwh = 0;
    let pendingCostCchEur = 0;
    let energiaPteEstimada = 0;
    let bImpPteEstimada = 0;

    let liveEstEur = 0;
    let liveEstMwh = 0;
    let liveCount = 0;

    let matureEstEur = 0;
    let matureGapEur = 0;
    let matureCount = 0;

    let incompleteMonths = 0;
    let latestUpdatedAt: Date | null = null;

    for (const r of computedRows) {
      invoicedMwh += r.invoicedMwh;
      demandaBcEstimada += r.demandaBcEstimada;
      demandaBcCch += r.demandaBcCch;
      descuadre += r.descuadre;
      liquidatedMwh += r.liquidatedMwh;
      pendingMwh += r.pendingMwh;
      pendingCostCchEur += r.estimatedPendingCostEur;
      energiaPteEstimada += r.energiaPteEstimada;
      bImpPteEstimada += r.bImpPteEstimada;

      if (r.mature) {
        matureEstEur += r.bImpPteEstimada;
        matureGapEur += r.descuadre * r.avgPrice;
        matureCount++;
      } else {
        liveEstEur += r.bImpPteEstimada;
        liveEstMwh += r.energiaPteEstimada;
        liveCount++;
      }

      if (r.cchDays < r.daysInMonth || r.reganecuDays < r.daysInMonth) {
        incompleteMonths++;
      }

      if (r.updatedAt) {
        const dt = new Date(r.updatedAt);
        if (!isNaN(dt.getTime()) && (!latestUpdatedAt || dt > latestUpdatedAt)) {
          latestUpdatedAt = dt;
        }
      }
    }

    return {
      invoicedMwh,
      demandaBcEstimada,
      demandaBcCch,
      descuadre,
      liquidatedMwh,
      pendingMwh,
      pendingCostCchEur,
      energiaPteEstimada,
      bImpPteEstimada,
      liveEstEur,
      liveEstMwh,
      liveCount,
      matureEstEur,
      matureGapEur,
      matureCount,
      incompleteMonths,
      latestUpdatedAt,
    };
  }, [computedRows]);

  const handleExportSummaryExcel = () => {
    if (computedRows.length === 0) return;

    const mainSheetRows = computedRows.map((r) => ({
      Mes: r.month,
      'Último Cierre': r.cierre,
      'Días CCH': `${r.cchDays}/${r.daysInMonth}`,
      'Días REE': `${r.reganecuDays}/${r.daysInMonth}`,
      'Energía Facturada (MWh)': Number(r.invoicedMwh.toFixed(2)),
      'F1 Sin Facturar (MWh)': Number((r.f1UnbilledMwh || 0).toFixed(2)),
      '% Pérdidas Media': Number(((r.lossRatio - 1) * 100).toFixed(2)),
      'Demanda BC Estimada (MWh)': Number(r.demandaBcEstimada.toFixed(2)),
      'Consumo CCH Contador (MWh)': Number((r.rawCchMwh || 0).toFixed(2)),
      'Excedentes CCH (MWh)': Number(r.surplusMwh.toFixed(2)),
      'Demanda BC CCH Recibidas (MWh)': Number(r.demandaBcCch.toFixed(2)),
      'Descuadre F1-CCH (MWh)': Number(r.descuadre.toFixed(2)),
      'Liquidado REE CAD (MWh)': Number(r.liquidatedMwh.toFixed(2)),
      'Energía Pte. según CCH (MWh)': Number(r.pendingMwh.toFixed(2)),
      'B.Imp. Pte. según CCH (€)': Number(r.estimatedPendingCostEur.toFixed(2)),
      'Precio Descuadre OMIE+Restr (€/MWh)': Number(r.avgPrice.toFixed(2)),
      'Energía Pte. Estimada (MWh)': Number(r.energiaPteEstimada.toFixed(2)),
      'B.Imp. Pte. Estimada (€)': Number(r.bImpPteEstimada.toFixed(2)),
    }));

    mainSheetRows.push({
      Mes: 'TOTAL 12 MESES',
      'Último Cierre': '-',
      'Días CCH': '-',
      'Días REE': '-',
      'Energía Facturada (MWh)': Number(totals.invoicedMwh.toFixed(2)),
      'F1 Sin Facturar (MWh)': Number(
        computedRows.reduce((acc, r) => acc + (r.f1UnbilledMwh || 0), 0).toFixed(2)
      ),
      '% Pérdidas Media': Number(
        (
          ((totals.demandaBcCch /
            Math.max(
              1,
              computedRows.reduce((acc, r) => acc + (r.rawCchMwh || 0), 0)
            ) -
            1) *
            100) || 0
        ).toFixed(2)
      ),
      'Demanda BC Estimada (MWh)': Number(totals.demandaBcEstimada.toFixed(2)),
      'Consumo CCH Contador (MWh)': Number(
        computedRows.reduce((acc, r) => acc + (r.rawCchMwh || 0), 0).toFixed(2)
      ),
      'Excedentes CCH (MWh)': Number(
        computedRows.reduce((acc, r) => acc + r.surplusMwh, 0).toFixed(2)
      ),
      'Demanda BC CCH Recibidas (MWh)': Number(totals.demandaBcCch.toFixed(2)),
      'Descuadre F1-CCH (MWh)': Number(totals.descuadre.toFixed(2)),
      'Liquidado REE CAD (MWh)': Number(totals.liquidatedMwh.toFixed(2)),
      'Energía Pte. según CCH (MWh)': Number(totals.pendingMwh.toFixed(2)),
      'B.Imp. Pte. según CCH (€)': Number(totals.pendingCostCchEur.toFixed(2)),
      'Precio Descuadre OMIE+Restr (€/MWh)': 0,
      'Energía Pte. Estimada (MWh)': Number(totals.energiaPteEstimada.toFixed(2)),
      'B.Imp. Pte. Estimada (€)': Number(totals.bImpPteEstimada.toFixed(2)),
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(mainSheetRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Energia Pendiente 12M');
    XLSX.writeFile(wb, `Energia_Pendiente_REE_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportAuditExcel = () => {
    if (!auditData) return;
    const wb = XLSX.utils.book_new();

    const distRows = auditData.byDistributor.map((d) => ({
      Distribuidora: d.distributor,
      'CUPS Activos': d.activeCups,
      'CUPS con CCH': d.cupsWithCch,
      'CUPS sin CCH': d.cupsMissingCch,
      'Facturado (MWh)': d.billedMwh,
      'F1 Sin Facturar (MWh)': d.unbilledF1Mwh,
      'CCH Contador (MWh)': d.cchMwh,
      'Excedentes (MWh)': d.surplusMwh,
      'Descuadre Fact-CCH (MWh)': d.gapMwh,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(distRows), 'Por Distribuidora');

    const cupsRows = auditData.topCupsDiscrepancies.map((c) => ({
      CUPS: c.cups,
      Cliente: c.clientName,
      Tarifa: c.tariff,
      Distribuidora: c.distributor,
      Diagnóstico: c.statusTag,
      'Días CCH': `${c.cchDays}/${auditData.daysInMonth}`,
      'Días Provisionales': c.provisionalDays,
      'Facturado (MWh)': c.billedMwh,
      'F1 Sin Facturar (MWh)': c.unbilledF1Mwh,
      'CCH Contador (MWh)': c.cchMwh,
      'Descuadre (MWh)': c.gapMwh,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cupsRows), 'Top 50 CUPS Descuadre');

    if (auditData.summary?.details?.closureHistory?.length) {
      const histRows = auditData.summary.details.closureHistory.map((h) => ({
        Cierre: h.cierre,
        'Días Liquidados': h.days,
        'Energía CAD (MWh)': h.liquidatedMwh,
        'Coste CAD (€)': h.cadCostEur,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), 'Evolucion Cierres REE');
    }

    XLSX.writeFile(wb, `Auditoria_Energia_${auditData.month}.xlsx`);
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setProgressMsg('Iniciando recálculo...');
    const t = toast.loading('Iniciando recálculo...');
    try {
      const res = await fetch('/api/gestion/energia-pendiente/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebuildAggregates }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error('Stream de progreso no disponible');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.substring(6));
                if (payload.msg) {
                  setProgressMsg(payload.msg);
                  toast.loading(payload.msg, { id: t });
                }
                if (payload.done) {
                  setProgressMsg('Cálculo finalizado exitosamente');
                  toast.success('Cálculo finalizado exitosamente', { id: t, duration: 4000 });
                  await loadData();
                  setIsRecalculating(false);
                  setTimeout(() => setProgressMsg(''), 3000);
                }
                if (payload.error) {
                  setProgressMsg('Error: ' + payload.error);
                  toast.error(payload.error, { id: t });
                  setIsRecalculating(false);
                }
              } catch {
                // Ignorar fragmento SSE parcial
              }
            }
          }
        }
      }
    } catch (err: any) {
      setProgressMsg('Error: ' + err.message);
      toast.error(err.message, { id: t });
      setIsRecalculating(false);
    }
  };

  const filteredAuditCups = useMemo(() => {
    if (!auditData?.topCupsDiscrepancies) return [];
    const q = cupsSearch.trim().toLowerCase();
    if (!q) return auditData.topCupsDiscrepancies;
    return auditData.topCupsDiscrepancies.filter(
      (c) =>
        c.cups.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.distributor.toLowerCase().includes(q) ||
        c.tariff.toLowerCase().includes(q)
    );
  }, [auditData, cupsSearch]);

  if (loading && data.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px auto', color: 'var(--lime)' }} />
        <p>Cargando resumen de energía pendiente de liquidar (últimos 12 meses cerrados)...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '24px',
          background: 'rgba(239,68,68,0.1)',
          color: 'var(--danger)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <AlertCircle size={24} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* TARJETAS KPI EJECUTIVAS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1: Saldo según CCH */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Saldo Físico según CCH (12m)
            </span>
            <Activity size={18} style={{ color: totals.pendingCostCchEur > 0 ? '#ef4444' : '#22c55e' }} />
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: totals.pendingCostCchEur > 0 ? '#ef4444' : '#22c55e',
            }}
          >
            {formatEur(Math.abs(totals.pendingCostCchEur))}{' '}
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
              {totals.pendingCostCchEur > 0 ? '(A pagar)' : '(A cobrar)'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Neto energía: {totals.pendingMwh > 0 ? '+' : ''}
            {formatMwh(totals.pendingMwh)} MWh (CCH vs CAD REE)
          </div>
        </div>

        {/* KPI 2: Provisión Cierres Vivos A1-C3 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Provisión Cierres Vivos (A1–C3)
            </span>
            <Layers size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: totals.liveEstEur > 0 ? '#ef4444' : '#22c55e',
            }}
          >
            {formatEur(Math.abs(totals.liveEstEur))}{' '}
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
              {totals.liveEstEur > 0 ? '(A pagar)' : '(A cobrar)'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {totals.liveCount} meses abiertos a regularización SIMEL ({totals.liveEstMwh > 0 ? '+' : ''}
            {formatMwh(totals.liveEstMwh)} MWh)
          </div>
        </div>

        {/* KPI 3: Descuadre en Cierres Maduros A4-C8 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Cierres Maduros (A4–C8)
            </span>
            <CheckCircle2 size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: totals.matureEstEur > 0 ? '#f59e0b' : '#22c55e',
            }}
          >
            {formatEur(Math.abs(totals.matureEstEur))}{' '}
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
              {totals.matureEstEur > 0 ? '(Est. prudencial)' : '(A cobrar)'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {totals.matureCount} meses en cierre ≥4 (Efecto descuadre F1: {formatEur(totals.matureGapEur)})
          </div>
        </div>

        {/* KPI 4: Estado y Cobertura */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estado de Sincronización
            </span>
            <Clock size={18} style={{ color: 'var(--lime)' }} />
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {totals.latestUpdatedAt
              ? totals.latestUpdatedAt.toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Sin calcular'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {companyName ? `${companyName} · ` : ''}
            {totals.incompleteMonths > 0 ? (
              <span style={{ color: '#f59e0b' }}>{totals.incompleteMonths} mes(es) con cobertura parcial</span>
            ) : (
              <span style={{ color: '#22c55e' }}>12/12 meses con cobertura completa</span>
            )}
          </div>
        </div>
      </div>

      {/* PANEL PRINCIPAL */}
      <div
        style={{
          background: 'var(--bg-surface)',
          padding: '28px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '14px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Energía Pendiente de Liquidar (REE)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '880px' }}>
              Cruza horariamente la demanda física en Barras de Central (curvas CCH + pérdidas BOE × Factor K − excedentes P.O. 14.8) con la última liquidación disponible por día en REGANECU. Haz clic en cualquier mes para auditar cierres, distribuidoras y CUPS con descuadre.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={monthsRange}
                onChange={(e) => setMonthsRange(Number(e.target.value))}
                disabled={isRecalculating}
                title="Ventana temporal mostrada (el ciclo completo de cierres REE hasta C8 abarca 18 meses)"
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: '0.83rem',
                  cursor: 'pointer',
                }}
              >
                <option value={12}>Últimos 12 meses</option>
                <option value={18}>Últimos 18 meses (Ciclo C8)</option>
              </select>

              <label
                title="Si activas esta opción, antes de calcular se regenerarán desde cero las curvas agregadas CCH de los últimos 380 días a partir de las lecturas individuales de cada CUPS."
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  cursor: isRecalculating ? 'not-allowed' : 'pointer',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: rebuildAggregates ? 'rgba(222,255,154,0.1)' : 'var(--bg-base)',
                }}
              >
                <input
                  type="checkbox"
                  checked={rebuildAggregates}
                  disabled={isRecalculating}
                  onChange={(e) => setRebuildAggregates(e.target.checked)}
                  style={{ accentColor: 'var(--lime)' }}
                />
                Reconstruir CCH (12m)
              </label>

              <button
                onClick={handleExportSummaryExcel}
                disabled={computedRows.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: computedRows.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                }}
              >
                <Download size={15} />
                Exportar Excel
              </button>

              <button
                disabled={isRecalculating}
                onClick={handleRecalculate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: isRecalculating ? 'var(--bg-base)' : 'var(--lime)',
                  color: isRecalculating ? 'var(--text-muted)' : '#0B0F19',
                  border: isRecalculating ? '1px solid var(--border)' : 'none',
                  borderRadius: '6px',
                  cursor: isRecalculating ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  transition: 'all 0.2s',
                }}
              >
                {isRecalculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {isRecalculating ? 'Procesando...' : 'Recalcular Ahora'}
              </button>
            </div>

            {isRecalculating && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--lime)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--lime)',
                    display: 'inline-block',
                  }}
                />
                {progressMsg}
              </div>
            )}
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mes</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Último Cierre</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Energía Facturada</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Demanda BC Estimada</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Demanda BC CCH recibidas</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Descuadre F1-CCH</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Liquidado REE</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Energía Pte. según CCH</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>B.Imp. Pte. según CCH</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Energía Pte. Estimada</th>
                <th style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>B.Imp. Pte. Estimada</th>
              </tr>
            </thead>
            <tbody>
              {computedRows.map((row) => {
                const isPositiveEnergy = row.pendingMwh > 0;
                const isPositiveCost = row.estimatedPendingCostEur > 0;
                const isPositiveEstEnergy = row.energiaPteEstimada > 0;
                const isPositiveEstCost = row.bImpPteEstimada > 0;

                const colorCode = isPositiveCost ? '#ef4444' : '#22c55e';
                const colorCodeEst = isPositiveEstCost ? '#ef4444' : '#22c55e';

                const cchIncomplete = row.cchDays < row.daysInMonth;
                const reeIncomplete = row.reganecuDays > 0 && row.reganecuDays < row.daysInMonth;
                const defClosure = isDefinitiveClosure(row.cierre);

                const omieInfo = row.details?.omieAvg !== undefined ? `OMIE: ${row.details.omieAvg.toFixed(2)}` : '';
                const resInfo =
                  row.details?.restriccionesAvg !== undefined
                    ? ` + Restr: ${row.details.restriccionesAvg.toFixed(2)}`
                    : '';

                return (
                  <tr
                    key={row.month}
                    onClick={() => openMonthAudit(row.month)}
                    title="Haz clic para abrir la auditoría detallada de CUPS, distribuidoras y cierres REE de este mes"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '14px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{row.month}</span>
                        <Search size={13} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      {(cchIncomplete || reeIncomplete || row.cierre === 'N/A') && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {cchIncomplete && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'rgba(245,158,11,0.15)',
                                color: '#f59e0b',
                              }}
                            >
                              CCH {row.cchDays}/{row.daysInMonth}d
                            </span>
                          )}
                          {reeIncomplete && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'rgba(239,68,68,0.15)',
                                color: '#ef4444',
                              }}
                            >
                              REE {row.reganecuDays}/{row.daysInMonth}d
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background:
                              row.cierre === 'N/A'
                                ? 'var(--bg-base)'
                                : defClosure
                                  ? 'var(--lime)'
                                  : 'rgba(245, 158, 11, 0.2)',
                            color:
                              row.cierre === 'N/A'
                                ? 'var(--text-muted)'
                                : defClosure
                                  ? '#0B0F19'
                                  : '#fbbf24',
                            border:
                              row.cierre !== 'N/A' && !defClosure ? '1px solid rgba(245,158,11,0.4)' : 'none',
                          }}
                        >
                          {row.cierre}
                        </span>
                        {row.mature && (
                          <span
                            title="Cierre maduro (≥ A4/C4): baja probabilidad de variaciones significativas de demanda en REE."
                            style={{
                              fontSize: '0.68rem',
                              color: '#60a5fa',
                              background: 'rgba(59,130,246,0.12)',
                              padding: '2px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            Maduro
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      <div>{formatMwh(row.invoicedMwh)} MWh</div>
                      {(row.f1UnbilledMwh || 0) >= 0.5 && (
                        <div
                          title="Energía en ficheros F1 de distribuidora recibidos aún pendientes de facturar al cliente"
                          style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '2px' }}
                        >
                          +{formatMwh(row.f1UnbilledMwh || 0)} F1 pte.
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      <div>{formatMwh(row.demandaBcEstimada)} MWh</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Pérd: +{((row.lossRatio - 1) * 100).toFixed(1)}%
                      </div>
                    </td>

                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      <div>{formatMwh(row.demandaBcCch)} MWh</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Cont: {formatMwh(row.rawCchMwh || 0)}
                        {row.surplusMwh > 0.05 ? ` (−${formatMwh(row.surplusMwh)} exc.)` : ''}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: '14px 12px',
                        textAlign: 'right',
                        fontWeight: Math.abs(row.descuadre) > 1 ? 600 : 400,
                        color: row.descuadre > 0 ? '#ef4444' : '#22c55e',
                      }}
                    >
                      {row.descuadre > 0 ? '+' : ''}
                      {formatMwh(row.descuadre)} MWh
                    </td>

                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {row.cierre !== 'N/A' ? `${formatMwh(row.liquidatedMwh)} MWh` : '-'}
                    </td>

                    <td style={{ padding: '14px 12px', fontWeight: 600, textAlign: 'right', color: colorCode }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {isPositiveEnergy ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        {formatMwh(Math.abs(row.pendingMwh))} MWh
                      </div>
                    </td>

                    <td style={{ padding: '14px 12px', fontWeight: 600, color: colorCode, textAlign: 'right' }}>
                      <div>
                        {formatEur(Math.abs(row.estimatedPendingCostEur))}{' '}
                        <span style={{ fontSize: '0.78rem' }}>{isPositiveCost ? '(A pagar)' : '(A cobrar)'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 12px', fontWeight: 600, textAlign: 'right', color: colorCodeEst }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {isPositiveEstEnergy ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        {formatMwh(Math.abs(row.energiaPteEstimada))} MWh
                      </div>
                    </td>

                    <td
                      style={{ padding: '14px 12px', fontWeight: 600, color: colorCodeEst, textAlign: 'right' }}
                      title={omieInfo ? `Precio aplicado al descuadre: ${omieInfo}${resInfo} €/MWh` : undefined}
                    >
                      <div>
                        {formatEur(Math.abs(row.bImpPteEstimada))}{' '}
                        <span style={{ fontSize: '0.78rem' }}>{isPositiveEstCost ? '(A pagar)' : '(A cobrar)'}</span>
                      </div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                        Descuadre @ {row.avgPrice.toFixed(2)} €/MWh
                      </div>
                    </td>
                  </tr>
                );
              })}

              {computedRows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay datos disponibles para los últimos 12 meses cerrados. Pulsa &ldquo;Recalcular Ahora&rdquo; para generarlos.
                  </td>
                </tr>
              )}
            </tbody>

            {computedRows.length > 0 && (
              <tfoot>
                <tr
                  style={{
                    background: 'rgba(222, 255, 154, 0.05)',
                    borderTop: '2px solid var(--border-strong)',
                    fontWeight: 700,
                  }}
                >
                  <td style={{ padding: '16px 12px', color: 'var(--lime)' }}>TOTAL 12M</td>
                  <td style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {computedRows.length} meses
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatMwh(totals.invoicedMwh)} MWh
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatMwh(totals.demandaBcEstimada)} MWh
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatMwh(totals.demandaBcCch)} MWh
                  </td>
                  <td
                    style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      color: totals.descuadre > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {totals.descuadre > 0 ? '+' : ''}
                    {formatMwh(totals.descuadre)} MWh
                  </td>
                  <td style={{ padding: '16px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatMwh(totals.liquidatedMwh)} MWh
                  </td>
                  <td
                    style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      color: totals.pendingCostCchEur > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {totals.pendingMwh > 0 ? '+' : ''}
                    {formatMwh(totals.pendingMwh)} MWh
                  </td>
                  <td
                    style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      color: totals.pendingCostCchEur > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {formatEur(Math.abs(totals.pendingCostCchEur))}{' '}
                    <span style={{ fontSize: '0.78rem' }}>
                      {totals.pendingCostCchEur > 0 ? '(A pagar)' : '(A cobrar)'}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      color: totals.bImpPteEstimada > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {totals.energiaPteEstimada > 0 ? '+' : ''}
                    {formatMwh(totals.energiaPteEstimada)} MWh
                  </td>
                  <td
                    style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      color: totals.bImpPteEstimada > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {formatEur(Math.abs(totals.bImpPteEstimada))}{' '}
                    <span style={{ fontSize: '0.78rem' }}>
                      {totals.bImpPteEstimada > 0 ? '(A pagar)' : '(A cobrar)'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* LEYENDA TÉCNICA */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'var(--bg-base)',
            borderRadius: '8px',
            fontSize: '0.83rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          <p style={{ marginBottom: '6px' }}>
            <strong>Demanda BC CCH recibidas:</strong> Consumo real horario de las curvas CCH elevadas a Barras de Central con las pérdidas vigentes del BOE ajustadas por el Factor K cuartohorario (COMPODEM), minoradas por los excedentes netos de autoconsumo según el P.O. 14.8.
          </p>
          <p style={{ marginBottom: '6px' }}>
            <strong>Demanda BC Estimada y Descuadre F1-CCH:</strong> Eleva la energía activa facturada a clientes (prorrateada exactamente por días dentro del mes natural, incluyendo facturas internas y respetando abonos/regularizadoras negativas) usando el coeficiente real de pérdidas del mes.
          </p>
          <p style={{ marginBottom: '6px' }}>
            <strong>Energía y B.Imp. Pte. según CCH:</strong> Diferencia horaria exacta entre la demanda medida en CCH y la liquidada por REE en el mejor cierre disponible de cada día, valorada hora a hora a precio de desvío (anclado a OMIE en horas sin desvío propio) + coste unitario real de CAD (OS + Restricciones) + Pagos por Capacidad (PC3).
          </p>
          <p style={{ margin: 0 }}>
            <strong>Energía y B.Imp. Pte. Estimada:</strong> Añade al saldo físico CCH el descuadre F1-CCH valorado al precio medio mensual de <strong>OMIE + Restricciones</strong>. En cierres vivos (<code>A1–C3</code>) anticipa la provisión futura cuando distribuidora vuelque lecturas a SIMEL; en cierres maduros (<code>≥ A4/C4</code>) identifica sobrefacturación estimada latente.
          </p>
        </div>
      </div>

      {/* MODAL DE AUDITORÍA MENSUAL */}
      {selectedMonth && (
        <div
          onClick={() => setSelectedMonth(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '1160px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Cabecera del Modal */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Auditoría de Energía y Descuadre — {selectedMonth}
                  </h3>
                  {auditData?.summary?.cierre && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: 'var(--lime)',
                        color: '#0B0F19',
                      }}
                    >
                      Cierre {auditData.summary.cierre}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Comparativa en punto frontera (contador sin pérdidas) entre energía facturada prorrateada y curvas CCH recibidas por distribuidora y CUPS.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {auditData && (
                  <button
                    onClick={handleExportAuditExcel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 12px',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                    }}
                  >
                    <Download size={14} />
                    Exportar Auditoría
                  </button>
                )}
                <button
                  onClick={() => setSelectedMonth(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Pestañas */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-base)',
              }}
            >
              {[
                { id: 'cups', label: 'Top CUPS con Descuadre' },
                { id: 'distribuidoras', label: 'Desglose por Distribuidora' },
                { id: 'resumen', label: 'Evolución Cierres REE y Precios' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAuditTab(tab.id as any)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: auditTab === tab.id ? 'none' : '1px solid var(--border)',
                    background: auditTab === tab.id ? 'var(--lime)' : 'var(--bg-surface)',
                    color: auditTab === tab.id ? '#0B0F19' : 'var(--text-secondary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Cuerpo del Modal */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {auditLoading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: 'var(--lime)' }} />
                  <p>Cruzando facturas prorrateadas y curvas diarias CCH por CUPS...</p>
                </div>
              ) : !auditData ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron datos de auditoría para este mes.
                </div>
              ) : (
                <>
                  {/* Mini KPIs de Calidad del Mes */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                      gap: '12px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ padding: '12px 14px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CUPS Activos con CCH</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                        {auditData.quality.activeCupsWithCch} / {auditData.quality.activeCupsCount}
                        {auditData.quality.activeCupsMissingCch > 0 && (
                          <span style={{ fontSize: '0.78rem', color: '#ef4444', marginLeft: '6px' }}>
                            ({auditData.quality.activeCupsMissingCch} sin CCH)
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calidad Curvas CCH (Días-CUPS)</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px', color: '#22c55e' }}>
                        {auditData.quality.totalDefinitiveCurveDays.toLocaleString('es-ES')} def.{' '}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>{' '}
                        <span style={{ color: '#f59e0b' }}>
                          {auditData.quality.totalProvisionalCurveDays.toLocaleString('es-ES')} prov.
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Precio Descuadre (OMIE + Restr.)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: 'var(--lime)' }}>
                        {(auditData.summary?.marketPrice || 0).toFixed(2)} €/MWh
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        OMIE: {auditData.summary?.details?.omieAvg?.toFixed(2) ?? '-'} + Restr:{' '}
                        {auditData.summary?.details?.restriccionesAvg?.toFixed(2) ?? '-'}
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pérdidas Medias Aplicadas</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                        +{(((auditData.summary?.lossRatio || auditData.summary?.details?.lossRatio || 1.15) - 1) * 100).toFixed(2)}%
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Ponderado demanda: {auditData.summary?.details?.weightedMarketPrice?.toFixed(2) ?? '-'} €/MWh
                      </div>
                    </div>
                  </div>

                  {/* PESTAÑA 1: TOP CUPS */}
                  {auditTab === 'cups' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
                          <Search
                            size={15}
                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                          />
                          <input
                            type="text"
                            placeholder="Filtrar por CUPS, cliente, distribuidora o tarifa..."
                            value={cupsSearch}
                            onChange={(e) => setCupsSearch(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px 8px 34px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-base)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Mostrando top {filteredAuditCups.length} suministros ordenados por mayor descuadre absoluto
                        </span>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                          <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-secondary)' }}>CUPS / Cliente</th>
                              <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-secondary)' }}>Tarifa</th>
                              <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-secondary)' }}>Distribuidora</th>
                              <th style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>Días CCH</th>
                              <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-secondary)' }}>Diagnóstico</th>
                              <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>Facturado ( Contador )</th>
                              <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>CCH Contador</th>
                              <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>Descuadre Neto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAuditCups.map((c) => {
                              const tagStyle: Record<string, { label: string; bg: string; color: string }> = {
                                SIN_CCH: { label: 'Sin curvas CCH', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
                                CCH_INCOMPLETA: { label: 'CCH incompleta', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
                                FACTURADO_MAYOR: { label: 'Facturado > CCH (Est.)', bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
                                CCH_MAYOR: { label: 'CCH > Facturado', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
                                SIN_FACTURAR: { label: 'Pte. Facturar', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
                                OK: { label: 'Cuadrado', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
                              };
                              const badge = tagStyle[c.statusTag] || tagStyle.OK;

                              return (
                                <tr key={c.cups} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Link
                                        href={`/puntos-suministro/${c.supplyPointId}`}
                                        target="_blank"
                                        style={{
                                          color: 'var(--lime)',
                                          fontWeight: 600,
                                          textDecoration: 'none',
                                          fontFamily: 'JetBrains Mono, monospace',
                                          fontSize: '0.8rem',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        {c.cups}
                                        <ExternalLink size={12} />
                                      </Link>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                      {c.clientName}
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px', color: 'var(--text-primary)', fontWeight: 500 }}>{c.tariff}</td>
                                  <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '0.78rem', maxWidth: '220px' }}>
                                    {c.distributor}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: c.cchDays < auditData.daysInMonth ? '#f59e0b' : 'var(--text-secondary)' }}>
                                    {c.cchDays}/{auditData.daysInMonth}
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <span
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        fontSize: '0.73rem',
                                        fontWeight: 600,
                                        background: badge.bg,
                                        color: badge.color,
                                      }}
                                    >
                                      {badge.label}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                    {c.billedMwh.toFixed(3)} MWh
                                    {c.unbilledF1Mwh > 0.01 && (
                                      <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>+{c.unbilledF1Mwh.toFixed(3)} F1</div>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                    {c.cchMwh.toFixed(3)} MWh
                                  </td>
                                  <td
                                    style={{
                                      padding: '10px',
                                      textAlign: 'right',
                                      fontWeight: 700,
                                      color: c.gapMwh > 0 ? '#ef4444' : '#22c55e',
                                    }}
                                  >
                                    {c.gapMwh > 0 ? '+' : ''}
                                    {c.gapMwh.toFixed(3)} MWh
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 2: POR DISTRIBUIDORA */}
                  {auditTab === 'distribuidoras' && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-secondary)' }}>Distribuidora</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>CUPS Activos</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>Con CCH</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>Sin CCH</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>Facturado (MWh)</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>F1 Pte. (MWh)</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>CCH Contador (MWh)</th>
                            <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>Descuadre (MWh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditData.byDistributor.map((d) => (
                            <tr key={d.distributor} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building2 size={15} style={{ color: 'var(--text-muted)' }} />
                                {d.distributor}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{d.activeCups}</td>
                              <td style={{ padding: '10px', textAlign: 'right', color: '#22c55e' }}>{d.cupsWithCch}</td>
                              <td style={{ padding: '10px', textAlign: 'right', color: d.cupsMissingCch > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: d.cupsMissingCch > 0 ? 700 : 400 }}>
                                {d.cupsMissingCch}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-primary)' }}>{formatMwh(d.billedMwh)}</td>
                              <td style={{ padding: '10px', textAlign: 'right', color: d.unbilledF1Mwh > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                                {formatMwh(d.unbilledF1Mwh)}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-primary)' }}>{formatMwh(d.cchMwh)}</td>
                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: d.gapMwh > 0 ? '#ef4444' : '#22c55e' }}>
                                {d.gapMwh > 0 ? '+' : ''}
                                {formatMwh(d.gapMwh)} MWh
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* PESTAÑA 3: EVOLUCIÓN CIERRES REE Y TARIFAS */}
                  {auditTab === 'resumen' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                      {/* Evolución de Cierres REE */}
                      <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          Evolución de Liquidaciones REE Importadas (REGANECU)
                        </h4>
                        {auditData.summary?.details?.closureHistory?.length ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-secondary)' }}>Cierre</th>
                                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>Días</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>Demanda CAD</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>Δ vs Anterior</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>Coste CAD</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditData.summary.details.closureHistory.map((h, idx, arr) => {
                                const prev = idx > 0 ? arr[idx - 1] : null;
                                const delta = prev && prev.days === h.days ? h.liquidatedMwh - prev.liquidatedMwh : null;
                                return (
                                  <tr key={h.cierre} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px', fontWeight: 700, color: 'var(--lime)' }}>{h.cierre}</td>
                                    <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                      {h.days}/{auditData.daysInMonth}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                      {formatMwh(h.liquidatedMwh)} MWh
                                    </td>
                                    <td
                                      style={{
                                        padding: '8px',
                                        textAlign: 'right',
                                        color: delta === null ? 'var(--text-muted)' : delta > 0 ? '#ef4444' : '#22c55e',
                                      }}
                                    >
                                      {delta === null ? '-' : `${delta > 0 ? '+' : ''}${formatMwh(delta)} MWh`}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                      {formatEur(h.cadCostEur)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={16} />
                            No hay cierres REGANECU importados para este mes.
                          </div>
                        )}
                      </div>

                      {/* Desglose por Tarifa */}
                      <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          Elevación a Barras de Central por Tarifa (CCH)
                        </h4>
                        {auditData.summary?.details?.tariffBreakdown &&
                        Object.keys(auditData.summary.details.tariffBreakdown).length > 0 ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-secondary)' }}>Tarifa</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>Contador (MWh)</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>Barras Central (MWh)</th>
                                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>% Pérd. Efectiva</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(auditData.summary.details.tariffBreakdown).map(([tariff, vals]) => {
                                const pct = vals.rawMwh > 0 ? ((vals.bcMwh / vals.rawMwh - 1) * 100).toFixed(2) : '0.00';
                                return (
                                  <tr key={tariff} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>{tariff}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                      {formatMwh(vals.rawMwh)} MWh
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                      {formatMwh(vals.bcMwh)} MWh
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--lime)' }}>+{pct}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Sin curvas CCH agregadas por tarifa en este mes.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
