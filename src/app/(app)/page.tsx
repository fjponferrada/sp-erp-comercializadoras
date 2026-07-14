'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import {
  Zap, TrendingUp, Users, Receipt, AlertTriangle,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock,
  RefreshCcw, XCircle, ChevronRight, Activity, BatteryWarning
} from 'lucide-react';
import { getDashboardMetricsAction } from '@/app/actions/dashboardActions';
import { getEconomicAnalysis } from '@/app/actions/analysisActions';
import AnalysisDashboard from '@/components/analisis/AnalysisDashboard';
import Link from 'next/link';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVO: 'badge-active',
    TRAMITANDO: 'badge-process',
    BORRADOR: 'badge-draft',
    BAJA: 'badge-danger',
    RECHAZADO: 'badge-danger',
    RECHAZO_DISTRIBUIDORA: 'badge-danger',
    RECHAZO_COMERCIALIZADORA: 'badge-danger',
  };
  return `badge ${map[status] ?? 'badge-draft'}`;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    const userRole = (session?.user as any)?.role || 'CANAL';
    if (userRole === 'CLIENTE' || userRole === 'CLIENT') {
      router.push('/facturas');
      return;
    }
    if (['COMERCIAL', 'CANAL'].includes(userRole)) {
      router.push('/clientes');
      return;
    }

    async function load() {
      const [res, analysisRes] = await Promise.all([
        getDashboardMetricsAction(),
        getEconomicAnalysis()
      ]);
      if (res.success) {
        setData(res.data);
      } else {
        setData({ error: res.error });
      }
      setAnalysisData(analysisRes || []);
      setLoading(false);
    }
    load();
  }, [session, status, router]);

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="Cargando métricas en tiempo real..." />
        <div style={{ padding: '24px' }}>Cargando datos reales del sistema...</div>
      </>
    );
  }

  const kpis = data?.kpis || { activos: 0, tramitando: 0, rechazos: 0, bajas: 0, mwh: 0 };
  const recentContracts = data?.recentContracts || [];
  const renewalAlerts = data?.renewals || [];

  const kpiCards = [
    {
      label: 'Contratos Activos',
      value: kpis.activos.toString(),
      icon: CheckCircle2,
      color: 'var(--lime)',
    },
    {
      label: 'MWh Activos (Anual)',
      value: Math.round(kpis.mwh).toLocaleString('es-ES'),
      icon: Zap,
      color: 'var(--lime)',
    },
    {
      label: 'En Tramitación (Altas)',
      value: kpis.tramitando.toString(),
      icon: Clock,
      color: 'var(--info)',
    },
    {
      label: 'Contratos Rechazados',
      value: kpis.rechazos.toString(),
      icon: AlertTriangle,
      color: 'var(--danger)',
    },
    {
      label: 'Bajas Registradas',
      value: kpis.bajas.toString(),
      icon: BatteryWarning,
      color: 'var(--warning)',
    },
  ];

  return (
    <>
        <Topbar
          title="Dashboard"
          subtitle="Visión general de la comercializadora · Métricas en tiempo real"
        />

        <div style={{ padding: '24px', maxWidth: '1600px' }}>
          
          {data?.error && (
            <div style={{ padding: '16px', background: 'var(--danger)', color: 'white', marginBottom: '24px', borderRadius: '8px' }}>
              <strong>Error en getDashboardMetricsAction:</strong> {data.error}
            </div>
          )}

          {/* ——— KPIs Reales ——— */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {kpiCards.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {kpi.label}
                    </p>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: `rgba(${kpi.color === 'var(--lime)' ? '222,255,154' : kpi.color === 'var(--success)' ? '34,197,94' : kpi.color === 'var(--info)' ? '59,130,246' : kpi.color === 'var(--warning)' ? '245,158,11' : '239,68,68'},0.12)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon size={16} color={kpi.color} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                    {kpi.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ——— Renovaciones Críticas (Horizontal Stripe) ——— */}
          {renewalAlerts.length > 0 && (
            <div className="animate-fade-in-up delay-200" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <RefreshCcw size={16} color="var(--warning)" />
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Renovaciones Próximas (45d)
                </h3>
                <span className="badge badge-warning">{renewalAlerts.length}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                {renewalAlerts.map((r: any, i: number) => (
                  <div key={i} className="card" style={{
                    minWidth: '260px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                        {r.client}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--warning)' }}>
                        {r.expiresIn}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.cups?.slice(0, 16)}...
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {r.mwh.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} MWh
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ——— Estado de Servicios & Contratos Recientes ——— */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
            
            {/* Contratos Recientes */}
            <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Actividad Reciente
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Últimos contratos actualizados en el sistema
                  </p>
                </div>
                <Link href="/contratos" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--lime)', fontWeight: 600, textDecoration: 'none' }}>
                  Ver todos <ChevronRight size={13} />
                </Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CUPS / Referencia</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Tarifa</th>
                      <th>MWh/año</th>
                      <th>Canal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContracts.length === 0 && (
                      <tr><td colSpan={6} style={{textAlign: 'center', padding: '30px'}}>No hay contratos recientes</td></tr>
                    )}
                    {recentContracts.map((c: any) => (
                      <tr key={c.internalId} style={{ cursor: 'pointer' }}>
                        <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 500, fontSize: '0.75rem' }}>
                          {c.id?.slice(0, 18) || 'Sin ref'}...
                        </td>
                        <td className="primary-cell">{c.client}</td>
                        <td><span className={statusBadge(c.status)}>{c.status}</span></td>
                        <td className="mono-cell">{c.tariff}</td>
                        <td className="mono-cell">{c.mwh.toFixed(1)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.canal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Estado del Sistema */}
            <div className="card animate-fade-in-up delay-400" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="var(--info)" />
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Estado de Servicios
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', flex: 1 }}>
                {[
                  { label: 'Integración SIPS', ok: true },
                  { label: 'Firmas Contratos', ok: true },
                  { label: 'Cloudflare R2', ok: true },
                  { label: 'Módulo Facturación', ok: false },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    {s.ok
                      ? <span className="badge badge-active"><CheckCircle2 size={12} /> OK</span>
                      : <span className="badge badge-draft"><Clock size={12} /> Pdte</span>
                    }
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ——— Pie: Análisis Económico Integral ——— */}
          <div className="mt-8">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Activity size={20} color="var(--lime)" />
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Análisis Económico y Evolución de Cartera
              </h2>
            </div>
            <AnalysisDashboard data={analysisData} />
          </div>
        </div>
    </>
  );
}
