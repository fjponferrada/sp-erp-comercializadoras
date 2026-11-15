'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import AnalysisDashboard from '@/components/analisis/AnalysisDashboard';
import {
  getDashboardMetricsAction,
  type DashboardMetricsData,
  type SystemHealthStatus,
} from '@/app/actions/dashboardActions';
import {
  getEconomicAnalysis,
  type EconomicAnalysisRow,
} from '@/app/actions/analysisActions';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCcw,
  ChevronRight,
  Activity,
  BatteryWarning,
  ShieldAlert,
  FileSpreadsheet,
  MessageSquareWarning,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardClientProps {
  initialMetrics: DashboardMetricsData | null;
  initialError?: string | null;
  initialAnalysisData: EconomicAnalysisRow[];
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVO: 'badge-active',
    Activo: 'badge-active',
    ACEPTADO: 'badge-process',
    Aceptado: 'badge-process',
    TRAMITANDO: 'badge-process',
    Tramitando: 'badge-process',
    BORRADOR: 'badge-draft',
    Borrador: 'badge-draft',
    VERIFICANDO_FIRMA: 'badge-warning',
    RENOVACION: 'badge-warning',
    BAJA: 'badge-danger',
    FINALIZADO: 'badge-finalizado',
    Finalizado: 'badge-finalizado',
    RECHAZADO: 'badge-danger',
    RECHAZO_DISTRIBUIDORA: 'badge-danger',
    'Rechazo Distribuidora': 'badge-danger',
    'RECHAZO DISTRIBUIDORA': 'badge-danger',
    RECHAZO_COMERCIALIZADORA: 'badge-danger',
    RECHAZO_RIESGOS: 'badge-danger',
    RECHAZADO_POR_CLIENTE: 'badge-danger',
  };
  return `badge ${map[status] ?? 'badge-draft'}`;
};

const healthBadgeClass = (st: SystemHealthStatus) => {
  if (st === 'ok') return 'badge badge-active';
  if (st === 'warn') return 'badge badge-warning';
  return 'badge badge-danger';
};

function formatDateShort(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function DashboardClient({
  initialMetrics,
  initialError = null,
  initialAnalysisData,
}: DashboardClientProps) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetricsData | null>(initialMetrics);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [analysisData, setAnalysisData] = useState<EconomicAnalysisRow[]>(initialAnalysisData);
  const [refreshing, setRefreshing] = useState(false);

  // Sincronizar cuando router.refresh() re-ejecute el Server Component (ej. cambio de marca en BrandSelector)
  useEffect(() => {
    setMetrics(initialMetrics);
    setErrorMsg(initialError);
    setAnalysisData(initialAnalysisData);
  }, [initialMetrics, initialError, initialAnalysisData]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const [res, econ] = await Promise.all([
        getDashboardMetricsAction(),
        getEconomicAnalysis(),
      ]);
      if (res.success) {
        setMetrics(res.data);
        setErrorMsg(null);
      } else {
        setErrorMsg(res.error);
      }
      setAnalysisData(econ || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al actualizar métricas.');
    } finally {
      setRefreshing(false);
    }
  };

  const kpis = metrics?.kpis || {
    activos: 0,
    tramitando: 0,
    rechazos: 0,
    bajas: 0,
    mwh: 0,
  };
  const alerts = metrics?.operationalAlerts || {
    enRiesgoPaso11: 0,
    switchingWarnings: 0,
    pendingF1: 0,
    openClaimsR1: 0,
    urgentPaso03R1: 0,
    rechazos: 0,
  };
  const renewalsSummary = metrics?.renewalsSummary || {
    totalPending90d: 0,
    overdueCount: 0,
  };
  const renewalAlerts = metrics?.renewals || [];
  const recentContracts = metrics?.recentContracts || [];
  const systemHealth = metrics?.systemHealth || [];

  const economicSummary = useMemo(() => {
    const totalFacturacionEur = analysisData.reduce((acc, r) => acc + (r.facturacionEur || 0), 0);
    const totalMargenEur = analysisData.reduce((acc, r) => acc + (r.margenEur || 0), 0);

    // Último mes con facturación positiva de energía
    const lastInvoicedMonth =
      [...analysisData].reverse().find((m) => (m.facturacionMwh || 0) > 0) ||
      (analysisData.length > 0 ? analysisData[analysisData.length - 1] : null);

    // Último mes con movimiento o cartera activa para mostrar variación mensual relevante
    const lastPortfolioMonth =
      [...analysisData]
        .reverse()
        .find((m) => (m.altas || 0) > 0 || (m.bajas || 0) > 0 || (m.mwhActivos || 0) > 0) ||
      (analysisData.length > 0 ? analysisData[analysisData.length - 1] : null);

    const margenEurMwh = lastInvoicedMonth?.facturacionMwh
      ? (lastInvoicedMonth.margenEur / lastInvoicedMonth.facturacionMwh) * 1000
      : 0;

    return {
      totalFacturacionEur,
      totalMargenEur,
      lastInvoicedMonth,
      lastPortfolioMonth,
      margenEurMwh,
    };
  }, [analysisData]);

  const portfolioGrowthPct = (economicSummary.lastPortfolioMonth?.crecimientoMes ?? 0) * 100;

  const kpiCards = [
    {
      label: 'Contratos Activos',
      value: kpis.activos.toLocaleString('es-ES'),
      subtext: economicSummary.lastPortfolioMonth
        ? `+${economicSummary.lastPortfolioMonth.altas} altas (${economicSummary.lastPortfolioMonth.month})`
        : 'Cartera vigente deduplicada',
      subColor: 'var(--text-muted)',
      icon: CheckCircle2,
      iconColor: 'var(--lime)',
      iconBg: 'rgba(222, 255, 154, 0.12)',
      href: '/contratos',
    },
    {
      label: 'Volumen Vivo (MWh)',
      value: `${kpis.mwh.toLocaleString('es-ES', { maximumFractionDigits: 1 })}`,
      subtext: economicSummary.lastPortfolioMonth
        ? `${portfolioGrowthPct >= 0 ? '+' : ''}${portfolioGrowthPct.toFixed(2)}% var. (${economicSummary.lastPortfolioMonth.month})`
        : 'Consumo anual en cartera',
      subColor: portfolioGrowthPct >= 0 ? 'var(--success)' : 'var(--danger)',
      subIcon: portfolioGrowthPct >= 0 ? TrendingUp : TrendingDown,
      icon: Zap,
      iconColor: 'var(--lime)',
      iconBg: 'rgba(222, 255, 154, 0.12)',
      href: '/contratos',
    },
    {
      label: 'En Tramitación',
      value: kpis.tramitando.toLocaleString('es-ES'),
      subtext: 'Borrador, firma y switching ATR',
      subColor: 'var(--text-muted)',
      icon: Clock,
      iconColor: 'var(--info)',
      iconBg: 'rgba(59, 130, 246, 0.12)',
      href: '/contratos',
    },
    {
      label: 'Facturación B.I. Acum.',
      value: economicSummary.totalFacturacionEur.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }),
      subtext: `Margen acum.: ${economicSummary.totalMargenEur.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      })}`,
      subColor: economicSummary.totalMargenEur >= 0 ? 'var(--warning)' : 'var(--danger)',
      icon: Receipt,
      iconColor: 'var(--info)',
      iconBg: 'rgba(59, 130, 246, 0.12)',
      href: '/facturas',
    },
    {
      label: 'Margen Medio / MWh',
      value: economicSummary.lastInvoicedMonth?.facturacionMwh
        ? economicSummary.margenEurMwh.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '0,00 €',
      subtext: economicSummary.lastInvoicedMonth?.month
        ? `Últ. mes facturado (${economicSummary.lastInvoicedMonth.month})`
        : 'Sin facturación registrada',
      subColor: 'var(--text-muted)',
      icon: Activity,
      iconColor: 'var(--warning)',
      iconBg: 'rgba(245, 158, 11, 0.12)',
      href: '/facturas',
    },
    {
      label: 'Bajas Netas (CUPS)',
      value: kpis.bajas.toLocaleString('es-ES'),
      subtext: 'Histórico neto (carencia 30d)',
      subColor: 'var(--text-muted)',
      icon: BatteryWarning,
      iconColor: 'var(--warning)',
      iconBg: 'rgba(245, 158, 11, 0.12)',
      href: '/bajas',
    },
  ];

  const alertCards = [
    {
      key: 'paso11',
      label: 'Preaviso Fuga (Paso 11)',
      count: alerts.enRiesgoPaso11,
      detail: alerts.enRiesgoPaso11 > 0 ? 'Contratos activos en riesgo de baja' : 'Sin fugas entrantes activas',
      severity: alerts.enRiesgoPaso11 > 0 ? 'danger' : 'ok',
      icon: ShieldAlert,
      href: '/bajas',
    },
    {
      key: 'switching',
      label: 'Warnings Switching ATR',
      count: alerts.switchingWarnings,
      detail: alerts.switchingWarnings > 0 ? 'Incidencias XML sin resolver' : 'Bandeja ATR limpia',
      severity: alerts.switchingWarnings > 0 ? 'warning' : 'ok',
      icon: AlertTriangle,
      href: '/switching-warnings',
    },
    {
      key: 'f1',
      label: 'F1 Pte. de Facturar',
      count: alerts.pendingF1,
      detail: alerts.pendingF1 > 0 ? 'Peajes recibidos sin factura cliente' : 'Todo el F1 facturado',
      severity: alerts.pendingF1 > 0 ? 'warning' : 'ok',
      icon: FileSpreadsheet,
      href: '/ficheros-f1',
    },
    {
      key: 'claims',
      label: 'Reclamaciones R1 Vivas',
      count: alerts.openClaimsR1,
      detail:
        alerts.urgentPaso03R1 > 0
          ? `${alerts.urgentPaso03R1} pte. aportar info (Paso 03)`
          : alerts.openClaimsR1 > 0
            ? 'En curso ante distribuidora'
            : 'Sin reclamaciones abiertas',
      severity: alerts.urgentPaso03R1 > 0 ? 'danger' : alerts.openClaimsR1 > 0 ? 'warning' : 'ok',
      icon: MessageSquareWarning,
      href: '/reclamaciones',
    },
    {
      key: 'rechazos',
      label: 'Rechazos Tramitación',
      count: alerts.rechazos,
      detail: alerts.rechazos > 0 ? 'Contratos rechazados por revisar' : 'Sin rechazos activos',
      severity: alerts.rechazos > 0 ? 'danger' : 'ok',
      icon: XCircle,
      href: '/contratos',
    },
  ] as const;

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Centro de mando operativo y económico · Métricas en tiempo real"
        customActions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: refreshing ? 'wait' : 'pointer',
              opacity: refreshing ? 0.7 : 1,
            }}
            title="Actualizar métricas en tiempo real"
          >
            <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        }
      />

      <div style={{ padding: '24px', maxWidth: '1600px' }}>
        {errorMsg && (
          <div
            style={{
              padding: '14px 18px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              marginBottom: '20px',
              borderRadius: '10px',
              fontSize: '0.85rem',
            }}
          >
            <strong>Aviso al cargar métricas:</strong> {errorMsg}
          </div>
        )}

        {/* ——— 1. KPIs Ejecutivos Unificados (6 tarjetas clicables) ——— */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {kpiCards.map((kpi, i) => {
            const Icon = kpi.icon;
            const SubIcon = kpi.subIcon;
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={`card-stat animate-fade-in-up delay-${Math.min((i + 1) * 100, 500)}`}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                      gap: '8px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {kpi.label}
                    </p>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: kpi.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} color={kpi.iconColor} />
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.1,
                    }}
                  >
                    {kpi.value}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '10px',
                    fontSize: '0.73rem',
                    color: kpi.subColor,
                    fontWeight: 500,
                  }}
                >
                  {SubIcon && <SubIcon size={13} />}
                  <span>{kpi.subtext}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ——— 2. Centro de Alertas Operativas ——— */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <ShieldAlert size={16} color="var(--lime)" />
            <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Alertas Operativas y Tareas Pendientes
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
              gap: '12px',
            }}
          >
            {alertCards.map((item) => {
              const Icon = item.icon;
              const isDanger = item.severity === 'danger';
              const isWarning = item.severity === 'warning';
              const accent = isDanger
                ? 'var(--danger)'
                : isWarning
                  ? 'var(--warning)'
                  : 'var(--success)';
              const borderCol = isDanger
                ? 'rgba(239, 68, 68, 0.35)'
                : isWarning
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'var(--border)';

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    textDecoration: 'none',
                    border: `1px solid ${borderCol}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'background 0.15s ease, transform 0.15s ease',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '4px',
                      }}
                    >
                      <Icon size={14} color={accent} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.71rem',
                        color: isDanger ? '#fca5a5' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.detail}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: item.count > 0 ? accent : 'var(--text-muted)',
                      }}
                    >
                      {item.count.toLocaleString('es-ES')}
                    </span>
                    <ArrowUpRight size={14} color="var(--text-muted)" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ——— 3. Renovaciones Pendientes Reales (<= 90d, excluyendo ya renovadas) ——— */}
        {renewalAlerts.length > 0 && (
          <div className="animate-fade-in-up delay-200" style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <RefreshCcw size={16} color="var(--warning)" />
                <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Renovaciones Pendientes (≤ 90 días)
                </h3>
                <span className="badge badge-warning">
                  {renewalsSummary.totalPending90d.toLocaleString('es-ES')} pendientes
                </span>
                {renewalsSummary.overdueCount > 0 && (
                  <span className="badge badge-danger">
                    {renewalsSummary.overdueCount.toLocaleString('es-ES')} vencidas
                  </span>
                )}
              </div>

              <Link
                href="/renovaciones"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.76rem',
                  color: 'var(--lime)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Ir a Renovaciones <ChevronRight size={13} />
              </Link>
            </div>

            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
              {renewalAlerts.map((r) => {
                const isOverdue = r.urgency === 'overdue';
                const isUrgent = r.urgency === 'urgent';
                const borderColor = isOverdue
                  ? 'rgba(239, 68, 68, 0.35)'
                  : isUrgent
                    ? 'rgba(245, 158, 11, 0.35)'
                    : 'rgba(148, 163, 184, 0.2)';
                const tagColor = isOverdue
                  ? 'var(--danger)'
                  : isUrgent
                    ? 'var(--warning)'
                    : 'var(--info)';

                return (
                  <div
                    key={r.internalId}
                    className="card"
                    style={{
                      minWidth: '275px',
                      maxWidth: '300px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                      border: `1px solid ${borderColor}`,
                      flexShrink: 0,
                    }}
                    onClick={() => router.push(`/contratos/${r.internalId}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={r.client}
                      >
                        {r.client}
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: tagColor,
                          whiteSpace: 'nowrap',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {r.expiresIn}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.cups !== '-' ? `${r.cups.slice(0, 16)}…` : r.contractCode || '-'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {r.tariff} · {r.mwh.toLocaleString('es-ES', { maximumFractionDigits: 1 })} MWh
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ——— 4. Actividad Reciente + Salud Real del Sistema ——— */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start" style={{ marginBottom: '32px' }}>
          {/* Contratos Recientes (2/3 de anchura en pantallas grandes) */}
          <div className="card xl:col-span-2" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Actividad Reciente en Contratos
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Últimos expedientes actualizados (deduplicados por código)
                </p>
              </div>
              <Link
                href="/contratos"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  color: 'var(--lime)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Ver todos <ChevronRight size={13} />
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Referencia / CUPS</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th>Tarifa</th>
                    <th style={{ textAlign: 'right' }}>MWh/año</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentContracts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No hay contratos recientes
                      </td>
                    </tr>
                  )}
                  {recentContracts.map((c) => (
                    <tr
                      key={c.internalId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/contratos/${c.internalId}`)}
                    >
                      <td className="mono-cell" style={{ fontSize: '0.74rem' }}>
                        <div style={{ color: 'var(--lime)', fontWeight: 600 }}>{c.id}</div>
                        {c.contractCode && c.cups !== '-' && (
                          <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                            {c.cups.slice(0, 20)}
                          </div>
                        )}
                      </td>
                      <td className="primary-cell" style={{ maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div>{c.client}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {c.canal}
                        </div>
                      </td>
                      <td>
                        <span className={statusBadge(c.status)}>{c.status}</span>
                      </td>
                      <td className="mono-cell">{c.tariff}</td>
                      <td className="mono-cell" style={{ textAlign: 'right' }}>
                        {c.mwh.toLocaleString('es-ES', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="mono-cell" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatDateShort(c.updatedAtIso)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Telemetría Real de Servicios */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Activity size={16} color="var(--info)" />
              <div>
                <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Salud de Pipelines y Motores
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Telemetría real verificada contra PostgreSQL
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {systemHealth.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.detail}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span className={healthBadgeClass(s.status)}>
                      {s.status === 'ok' ? <CheckCircle2 size={11} /> : <Clock size={11} />} {s.statusText}
                    </span>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ——— 5. Análisis Económico y Evolución de Cartera ——— */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Activity size={20} color="var(--lime)" />
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Análisis Económico y Evolución de Cartera
            </h2>
          </div>
          <AnalysisDashboard data={analysisData} />
        </div>
      </div>
    </>
  );
}
