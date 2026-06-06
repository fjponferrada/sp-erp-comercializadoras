'use client';

import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import {
  Zap, TrendingUp, Users, Receipt, AlertTriangle,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock,
  RefreshCcw, XCircle, ChevronRight
} from 'lucide-react';

// ——— Datos de ejemplo (se sustituirán por datos reales de la BD) ——— 
const kpis = [
  {
    label: 'Contratos Activos',
    value: '247',
    change: '+12',
    changeLabel: 'este mes',
    up: true,
    icon: CheckCircle2,
    color: 'var(--success)',
  },
  {
    label: 'MWh Activos',
    value: '1.847',
    change: '+8,4%',
    changeLabel: 'vs mes anterior',
    up: true,
    icon: Zap,
    color: 'var(--lime)',
  },
  {
    label: 'Facturación Mes',
    value: '98.240 €',
    change: '+5,2%',
    changeLabel: 'vs mes anterior',
    up: true,
    icon: Receipt,
    color: 'var(--info)',
  },
  {
    label: 'Margen Medio',
    value: '7,34%',
    change: '-0,2pp',
    changeLabel: 'vs mes anterior',
    up: false,
    icon: TrendingUp,
    color: 'var(--warning)',
  },
  {
    label: 'Leads Activos',
    value: '38',
    change: '+6',
    changeLabel: 'esta semana',
    up: true,
    icon: Users,
    color: 'var(--lime)',
  },
  {
    label: 'Incidencias Abiertas',
    value: '4',
    change: '-2',
    changeLabel: 'esta semana',
    up: true,
    icon: AlertTriangle,
    color: 'var(--danger)',
  },
];

const recentContracts = [
  { id: 'ES0031406580959001DW', client: 'Talleres Hernández S.L.', status: 'ACTIVO', tariff: '6.1TD', mwh: 187.4, since: '15/05/2026', canal: 'Aguirreclima' },
  { id: 'ES0021000000394649KL', client: 'Clínica Dental Puerta Sur', status: 'TRAMITANDO', tariff: '3.0TD', mwh: 42.1, since: '22/05/2026', canal: 'AEC Energías' },
  { id: 'ES0031104781919001ZF', client: 'Hostelería MR 2020 S.L.', status: 'BORRADOR', tariff: '2.0TD', mwh: 12.8, since: '28/05/2026', canal: 'Directo' },
  { id: 'ES0031300601649001VA', client: 'Supermercados LídaSur', status: 'ACTIVO', tariff: '6.1TD', mwh: 542.0, since: '01/04/2026', canal: 'SP Asesoría' },
  { id: 'ES0022000007621842MN', client: 'Centro Deportivo Aquasur', status: 'ACTIVO', tariff: '3.0TD', mwh: 98.7, since: '10/04/2026', canal: 'Aguirreclima' },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVO: 'badge-active',
    TRAMITANDO: 'badge-process',
    BORRADOR: 'badge-draft',
    BAJA: 'badge-danger',
    RECHAZADO: 'badge-danger',
  };
  return `badge ${map[status] ?? 'badge-draft'}`;
};

const renewalAlerts = [
  { client: 'Autopartes García S.L.', cups: 'ES0031...591LD', expiresIn: '12 días', mwh: 45.2 },
  { client: 'Imprenta Offset Color', cups: 'ES0021...843KP', expiresIn: '18 días', mwh: 22.8 },
  { client: 'Colegio San Lorenzo', cups: 'ES0031...102ZA', expiresIn: '25 días', mwh: 88.0 },
];

export default function DashboardPage() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar
          title="Dashboard"
          subtitle="Visión general de la comercializadora · AED Energía"
        />

        <div style={{ padding: '24px', maxWidth: '1600px' }}>

          {/* ——— KPIs ——— */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            {kpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}
                >
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                    {kpi.up
                      ? <ArrowUpRight size={13} color="var(--success)" />
                      : <ArrowDownRight size={13} color="var(--danger)" />
                    }
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: kpi.up ? 'var(--success)' : 'var(--danger)' }}>
                      {kpi.change}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{kpi.changeLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ——— Main Grid: Contratos + Alertas ——— */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '16px' }}>

            {/* Contratos Recientes */}
            <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Contratos Recientes
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Últimas altas registradas
                  </p>
                </div>
                <a href="/contratos" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--lime)', fontWeight: 600, textDecoration: 'none' }}>
                  Ver todos <ChevronRight size={13} />
                </a>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CUPS</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Tarifa</th>
                      <th>MWh/año</th>
                      <th>Canal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentContracts.map((c) => (
                      <tr key={c.id} style={{ cursor: 'pointer' }}>
                        <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 500, fontSize: '0.75rem' }}>
                          {c.id.slice(0, 18)}...
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

            {/* Panel Derecho: Renovaciones y Estado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Alerta Renovaciones */}
              <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(245,158,11,0.3)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCcw size={15} color="var(--warning)" />
                  <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Renovaciones Urgentes
                  </h3>
                  <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{renewalAlerts.length}</span>
                </div>
                <div style={{ padding: '8px' }}>
                  {renewalAlerts.map((r, i) => (
                    <div key={i} style={{
                      padding: '10px 10px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.client}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.cups}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--warning)' }}>{r.expiresIn}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{r.mwh} MWh</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                  <a href="/renovaciones" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>
                    Ver renovaciones
                  </a>
                </div>
              </div>

              {/* Estado del Sistema */}
              <div className="card animate-fade-in-up delay-400">
                <h3 style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Estado del Sistema
                </h3>
                {[
                  { label: 'API SIPS (Google Cloud)', ok: true },
                  { label: 'FTP Facturas', ok: true },
                  { label: 'Sincronización Airtable', ok: false },
                  { label: 'Correo (Resend)', ok: true },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    {s.ok
                      ? <span className="badge badge-active"><CheckCircle2 size={10} /> OK</span>
                      : <span className="badge badge-danger"><XCircle size={10} /> Error</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ——— Pie: Análisis Económico por Mes ——— */}
          <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Análisis Económico Mensual
                </h2>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Últimos 5 meses · AED Energía
                </p>
              </div>
              <a href="/analisis" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--lime)', fontWeight: 600, textDecoration: 'none' }}>
                Ver análisis completo <ChevronRight size={13} />
              </a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Contratos Activos</th>
                    <th>Altas</th>
                    <th>Bajas</th>
                    <th>MWh Activos</th>
                    <th>Facturación €</th>
                    <th>Facturación MWh</th>
                    <th>€/MWh</th>
                    <th>Margen €</th>
                    <th>Margen %</th>
                    <th>Margen €/MWh</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { mes: '2026-01', activos: 198, altas: 14, bajas: 2, mwh: 892.3, facEur: 58240, facMwh: 210.4, eurMwh: 277.0, margen: 4280, margenPct: '7.3%', margenMwh: 20.3 },
                    { mes: '2026-02', activos: 210, altas: 18, bajas: 3, mwh: 941.1, facEur: 67120, facMwh: 241.8, eurMwh: 277.6, margen: 4912, margenPct: '7.3%', margenMwh: 20.3 },
                    { mes: '2026-03', activos: 225, altas: 22, bajas: 4, mwh: 1024.5, facEur: 78440, facMwh: 289.2, eurMwh: 271.3, margen: 5720, margenPct: '7.3%', margenMwh: 19.8 },
                    { mes: '2026-04', activos: 238, altas: 19, bajas: 6, mwh: 1124.8, facEur: 86310, facMwh: 312.4, eurMwh: 276.2, margen: 6340, margenPct: '7.3%', margenMwh: 20.3 },
                    { mes: '2026-05', activos: 247, altas: 16, bajas: 7, mwh: 1184.2, facEur: 98240, facMwh: 352.1, eurMwh: 278.9, margen: 7210, margenPct: '7.3%', margenMwh: 20.5 },
                  ].map((row) => (
                    <tr key={row.mes}>
                      <td className="mono-cell primary-cell">{row.mes}</td>
                      <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 600 }}>{row.activos}</td>
                      <td className="mono-cell" style={{ color: 'var(--success)' }}>+{row.altas}</td>
                      <td className="mono-cell" style={{ color: 'var(--danger)' }}>-{row.bajas}</td>
                      <td className="mono-cell">{row.mwh.toLocaleString('es-ES', { minimumFractionDigits: 1 })}</td>
                      <td className="mono-cell">{row.facEur.toLocaleString('es-ES')} €</td>
                      <td className="mono-cell">{row.facMwh.toFixed(1)}</td>
                      <td className="mono-cell">{row.eurMwh.toFixed(1)}</td>
                      <td className="mono-cell" style={{ color: 'var(--success)' }}>{row.margen.toLocaleString('es-ES')} €</td>
                      <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 600 }}>{row.margenPct}</td>
                      <td className="mono-cell">{row.margenMwh}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
