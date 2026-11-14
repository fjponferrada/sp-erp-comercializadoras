'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Zap,
  Download,
  RefreshCw,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Topbar from '@/components/Topbar';

function formatYmdEs(ymd?: string | null): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Convierte un vector horario (24 valores en kWh/h ≡ kW medios) a los 96 cuartos de hora (Q1..Q96)
 * expresados estrictamente en MW de potencia (NO en MWh cuarto-horarios), interpolando entre los
 * puntos medios horarios (h + 0.5) y los puntos medios de cada cuarto (q * 0.25 + 0.125) para
 * conservar el 100% de la energía diaria (Σ MW_q * 0.25 h = MWh totales).
 */
function interpolateHourlyKwhToQuarterlyMw(hourlyKwh: number[]): number[] {
  const xHours = Array.from({ length: 24 }, (_, i) => i + 0.5);
  const yMw = Array.from({ length: 24 }, (_, i) => (hourlyKwh[i] || 0) / 1000);
  const xQuarters = Array.from({ length: 96 }, (_, q) => q * 0.25 + 0.125);

  return xQuarters.map((xq) => {
    if (xq <= xHours[0]) return yMw[0];
    if (xq >= xHours[23]) return yMw[23];
    let i = 0;
    while (xHours[i + 1] < xq) i++;
    const x0 = xHours[i];
    const x1 = xHours[i + 1];
    const y0 = yMw[i];
    const y1 = yMw[i + 1];
    return Math.max(0, y0 + ((xq - x0) * (y1 - y0)) / (x1 - x0));
  });
}

function formatQuarterLabel(qIdx: number): string {
  const startMinTotal = qIdx * 15;
  const endMinTotal = (qIdx + 1) * 15;
  const sh = String(Math.floor(startMinTotal / 60)).padStart(2, '0');
  const sm = String(startMinTotal % 60).padStart(2, '0');
  const eh = String(Math.floor(endMinTotal / 60)).padStart(2, '0');
  const em = String(endMinTotal % 60).padStart(2, '0');
  return `Q${qIdx + 1} (${sh}:${sm}–${eh}:${em})`;
}

export default function ComprasDashboard({
  initialForecastResult,
  recentForecastHistory = [],
  activeContracts,
  lastTrainingDate,
  projectionData,
  auditStats,
  todayDateStr,
  defaultTomorrowDateStr,
  maxForecastDateStr,
}: any) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'auditoria' | 'prediccion'>('prediccion');
  const [loading, setLoading] = useState(false);
  const [deepSyncing, setDeepSyncing] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [lastTrainedAt, setLastTrainedAt] = useState<string | null>(lastTrainingDate || null);
  const [selectedTargetDate, setSelectedTargetDate] = useState<string>(
    defaultTomorrowDateStr || ''
  );
  const [tableResolution, setTableResolution] = useState<'96q' | '24h'>('96q');
  const [forecastResult, setForecastResult] = useState<any>(initialForecastResult || null);

  const generateForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compras/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate: selectedTargetDate || defaultTomorrowDateStr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al generar la predicción');
      setForecastResult(data);
      router.refresh();
    } catch (error: any) {
      alert('Error: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    setTraining(true);
    setTrainingProgress(0);

    const interval = setInterval(() => {
      setTrainingProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + 3;
      });
    }, 800);

    try {
      const res = await fetch('/api/cron/train-forecast', { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al entrenar el modelo');
      setTrainingProgress(100);
      if (data?.updatedAt) {
        setLastTrainedAt(data.updatedAt);
      } else {
        setLastTrainedAt(new Date().toISOString());
      }
      router.refresh();
    } catch (error: any) {
      alert('Error: ' + (error?.message || error));
      setTrainingProgress(0);
    } finally {
      clearInterval(interval);
      setTimeout(() => setTraining(false), 900);
    }
  };

  const runDeepSync = async () => {
    if (
      !confirm(
        'Esto regenerará las curvas agregadas de los últimos 365 días y verificará el histórico meteorológico provincial. Puede tardar alrededor de un minuto. ¿Continuar?'
      )
    ) {
      return;
    }
    setDeepSyncing(true);
    try {
      const res = await fetch('/api/cron/aggregate-history?days=365&repairWeather=1');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error en sincronización profunda');
      router.refresh();
      alert(
        `Sincronización profunda completada (${data.rowsInserted ?? 0} agrupaciones actualizadas).`
      );
    } catch (e: any) {
      alert(
        'Aviso al sincronizar: ' +
          (e?.message ||
            'Es posible que el proceso excediera el tiempo de espera, pero continúa en segundo plano.')
      );
    } finally {
      setDeepSyncing(false);
    }
  };

  const downloadOmieCSV = () => {
    if (!forecastResult) return;

    let csvBody =
      'SEGMENTO;' + Array.from({ length: 96 }, (_, i) => `Q${i + 1}`).join(';') + '\n';

    if (forecastResult.segmentBreakdown) {
      const segments = [
        'HOGAR 0-5kW',
        'HOGAR 5-10kW',
        'HOGAR 10-15kW',
        'PYME <50 MWh',
        'PYME >50 MWh',
        'VE <15 MWh',
        'VE >15 MWh',
        'VIP',
      ];
      for (const seg of segments) {
        const data = forecastResult.segmentBreakdown[seg];
        if (data) {
          csvBody += `${seg}`;
          for (let i = 0; i < 24; i++) {
            const mw = (data[i] / 1000).toFixed(3).replace('.', ',');
            // Repetimos la potencia horaria media (MW) en los 4 cuartos
            for (let q = 0; q < 4; q++) csvBody += `;${mw}`;
          }
          csvBody += '\n';
        }
      }
    }

    // ÚNICAMENTE PPAs FÍSICOS se descuentan de la oferta física en OMIE (Regla 234)
    if (forecastResult.ppaPhysicalPredictions && forecastResult.totalPpaPhysical > 0) {
      csvBody += 'PPA_FISICO_BILATERAL';
      for (let i = 0; i < 24; i++) {
        const mw = (-forecastResult.ppaPhysicalPredictions[i] / 1000)
          .toFixed(3)
          .replace('.', ',');
        for (let q = 0; q < 4; q++) csvBody += `;${mw}`;
      }
      csvBody += '\n';
    }

    // Suavizado centrado (Interpolación Lineal cuarto-horaria estrictamente en MW de potencia) para oferta OMIE
    const smoothPowerMw = interpolateHourlyKwhToQuarterlyMw(forecastResult.finalPrediction);

    const dateLabel = formatYmdEs(forecastResult.targetDate);
    csvBody += `TOTAL_OMIE_${dateLabel}`;

    for (let i = 0; i < 96; i++) {
      // OMIE exige potencia en MW en cada cuarto de hora (redondeo a 1 decimal conforme a OMIE_MW_lineal)
      const mw = smoothPowerMw[i].toFixed(1).replace('.', ',');
      csvBody += `;${mw}`;
    }
    csvBody += '\n';

    // Exportación mediante Blob con BOM UTF-8 (\uFEFF) para compatibilidad directa con Excel (Regla 214)
    const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `prediccion_OMIE_${forecastResult.targetDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalProjected12m = Array.isArray(projectionData)
    ? projectionData.reduce((acc: number, p: any) => acc + (p.mwh || 0), 0)
    : 0;

  return (
    <>
      <Topbar
        title="Compras de Energía"
        subtitle="Módulo avanzado de predicción de demanda con IA, geolocalización provincial y cobertura física en OMIE."
        showSearch={false}
      />

      <div style={{ padding: '28px 28px 48px' }}>
        <div className="card animate-fade-in-up" style={{ padding: 0 }}>
          <div
            style={{
              padding: '0 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: '24px',
            }}
          >
            <button
              onClick={() => setActiveTab('auditoria')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                color: activeTab === 'auditoria' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom:
                  activeTab === 'auditoria' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Activity size={16} />
              Auditoría de Datos
            </button>
            <button
              onClick={() => setActiveTab('prediccion')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                color: activeTab === 'prediccion' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom:
                  activeTab === 'prediccion' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Zap size={16} />
              Predicción IA
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {activeTab === 'auditoria' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="card-stat">
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Contratos Activos (CUPS 20)
                    </span>
                    <div
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        marginTop: '8px',
                      }}
                    >
                      {(auditStats?.activeContracts ?? activeContracts ?? 0).toLocaleString(
                        'es-ES'
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Histórico finalizados:{' '}
                      {(auditStats?.historicalFinalizedCount ?? 0).toLocaleString('es-ES')}
                    </div>
                  </div>

                  <div className="card-stat">
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Clima Histórico Open-Meteo
                    </span>
                    <div
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        color:
                          (auditStats?.weatherProvincesCount || 0) >= 50
                            ? 'var(--success)'
                            : '#F59E0B',
                        marginTop: '8px',
                      }}
                    >
                      {auditStats?.weatherProvincesCount ?? 0} / 52{' '}
                      <span
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                        }}
                      >
                        zonas
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {(auditStats?.weatherTotalRows ?? 0).toLocaleString('es-ES')} días·provincia (
                      {formatYmdEs(auditStats?.weatherMinDate)} →{' '}
                      {formatYmdEs(auditStats?.weatherMaxDate)})
                    </div>
                  </div>

                  <div className="card-stat">
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Estado del Modelo IA
                    </span>
                    <div
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: auditStats?.modelTrained ? 'var(--primary)' : '#F59E0B',
                        marginTop: '8px',
                      }}
                    >
                      {auditStats?.modelTrained
                        ? `Entrenado (v${auditStats.modelVersion})`
                        : 'Sin entrenar'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {auditStats?.modelMeta
                        ? `${auditStats.modelMeta.samplesUsed?.toLocaleString('es-ES')} nodos · ${auditStats.modelMeta.realWeatherPct ?? auditStats.realWeatherPct}% clima real`
                        : `${auditStats?.realWeatherPct ?? 0}% curvas con clima real`}
                    </div>
                  </div>

                  <div className="card-stat">
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Curvas Agregadas IA
                    </span>
                    <div
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        marginTop: '8px',
                      }}
                    >
                      {(auditStats?.aggTotalRows ?? 0).toLocaleString('es-ES')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {formatYmdEs(auditStats?.aggMinDate)} → {formatYmdEs(auditStats?.aggMaxDate)}{' '}
                      ({auditStats?.aggProvincesCount ?? 0} provincias)
                    </div>
                  </div>

                  <div className="card-stat">
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Factor K y Pérdidas BOE
                    </span>
                    <div
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        color: (auditStats?.kDaysCount || 0) > 0 ? 'var(--text-primary)' : '#F59E0B',
                        marginTop: '8px',
                      }}
                    >
                      {(auditStats?.kDaysCount ?? 0).toLocaleString('es-ES')}{' '}
                      <span
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                        }}
                      >
                        días K
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Último K: {formatYmdEs(auditStats?.kMaxDate)} ·{' '}
                      {auditStats?.lossTariffsCount ?? 0} tarifas BOE
                    </div>
                  </div>

                  <div className="card-stat">
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Cobertura PPAs en OMIE
                    </span>
                    <div
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        color: '#60A5FA',
                        marginTop: '8px',
                      }}
                    >
                      {auditStats?.activePhysicalPpasCount ?? 0}{' '}
                      <span
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                        }}
                      >
                        físicos activos
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {auditStats?.activeFinancialPpasCount ?? 0} PPA(s) financieros CfD (no
                      descuentan OMIE)
                    </div>
                  </div>
                </div>

                {/* Tabla de verificación de integridad de fuentes */}
                <div
                  style={{
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    background: 'var(--bg-elevated)',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--bg-base)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Diagnóstico de Integridad del Motor de Predicción
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            textAlign: 'left',
                          }}
                        >
                          <th style={{ padding: '12px 20px', fontWeight: 600 }}>Pilar Técnico</th>
                          <th style={{ padding: '12px 20px', fontWeight: 600 }}>Estado</th>
                          <th style={{ padding: '12px 20px', fontWeight: 600 }}>Detalle Verificado</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 600 }}>
                            1. Meteorología Provincial (Open-Meteo)
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            {(auditStats?.realWeatherPct || 0) >= 95 ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  color: 'var(--success)',
                                  fontWeight: 600,
                                }}
                              >
                                <CheckCircle2 size={15} /> Óptimo ({auditStats.realWeatherPct}%)
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  color: '#F59E0B',
                                  fontWeight: 600,
                                }}
                              >
                                <AlertTriangle size={15} /> Parcial ({auditStats?.realWeatherPct ?? 0}%)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>
                            {auditStats?.weatherProvincesCount ?? 0}/52 provincias canónicas sincronizadas
                            con temperaturas horarias reales (24h Europe/Madrid).
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 600 }}>
                            2. Compresión IA Ponderada (Decision Tree)
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: auditStats?.modelTrained ? 'var(--success)' : '#F59E0B',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={15} />{' '}
                              {auditStats?.modelTrained
                                ? `Activo v${auditStats.modelVersion}`
                                : 'Pendiente'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>
                            Media ponderada exacta por <code>clientCount</code>, downsampling determinista
                            (máx. 10.000 muestras) y separación estricta VIP/VE por SDA.
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 600 }}>
                            3. Regla de Mercado OMIE vs PPAs
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: 'var(--success)',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={15} /> Verificado
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>
                            Solo los PPAs <strong>FÍSICOS</strong> (bilaterales) reducen la compra física en
                            OMIE. Los PPAs <strong>FINANCIEROS (CfD)</strong> quedan excluidos al 100% del
                            volumen físico ofertado.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {recentForecastHistory && recentForecastHistory.length > 0 && (
                  <div
                    style={{
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <div
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Últimas Predicciones Generadas
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
                      >
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <th style={{ padding: '10px 20px', textAlign: 'left' }}>
                              Fecha Objetivo OMIE
                            </th>
                            <th style={{ padding: '10px 20px', textAlign: 'left' }}>Ejecutado</th>
                            <th style={{ padding: '10px 20px', textAlign: 'right' }}>
                              Demanda Bruta BC
                            </th>
                            <th style={{ padding: '10px 20px', textAlign: 'right' }}>
                              PPA Físico
                            </th>
                            <th style={{ padding: '10px 20px', textAlign: 'right' }}>
                              Compra Neta OMIE
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentForecastHistory.map((item: any) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 20px', fontWeight: 600 }}>
                                {formatYmdEs(item.targetDate)}
                              </td>
                              <td style={{ padding: '10px 20px', color: 'var(--text-muted)' }}>
                                {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
                              </td>
                              <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                                {item.totalGrossMwh.toLocaleString('es-ES', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                MWh
                              </td>
                              <td
                                style={{
                                  padding: '10px 20px',
                                  textAlign: 'right',
                                  color: '#60A5FA',
                                }}
                              >
                                -
                                {item.totalPpaPhysicalMwh.toLocaleString('es-ES', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                MWh
                              </td>
                              <td
                                style={{
                                  padding: '10px 20px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: 'var(--primary)',
                                }}
                              >
                                {item.totalNetMwh.toLocaleString('es-ES', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                MWh
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prediccion' && (
              <div className="space-y-8">
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--primary)',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px',
                  }}
                >
                  <p>
                    <strong>Nota sobre el Entrenamiento:</strong> No es necesario entrenar el modelo
                    más de una vez al día. La IA aprende de los históricos de demanda y clima real
                    provincial, por lo que incluso entrenándolo <strong>una vez por semana</strong> es
                    suficiente para mantener máxima precisión.
                  </p>
                  {lastTrainedAt && (
                    <div
                      style={{
                        background: 'var(--bg-base)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                        minWidth: 'fit-content',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          display: 'block',
                          marginBottom: '2px',
                        }}
                      >
                        Último Entrenamiento
                      </span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        {format(new Date(lastTrainedAt), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                  )}
                </div>

                {activeContracts === 0 && (
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Info
                      size={18}
                      style={{ color: '#60A5FA', flexShrink: 0, marginTop: '2px' }}
                    />
                    <div>
                      <strong>Cartera actual con 0 contratos en estado ACTIVO:</strong> La proyección
                      de consumo a 12 meses y el volumen físico a comprar en OMIE muestran{' '}
                      <strong>0 MWh</strong> porque no hay suministros activos hoy en la
                      comercializadora. El motor de IA sigue 100% entrenado sobre las{' '}
                      <strong>
                        {(auditStats?.aggTotalRows ?? 0).toLocaleString('es-ES')} curvas históricas
                      </strong>{' '}
                      y temperaturas reales provinciales, listo en cuanto se activen suministros.
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    background: 'var(--bg-elevated)',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      Generador de Predicción Diaria OMIE
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Árboles de Decisión provinciales (IA), perfiles VIP/VE (SDA) y descuento
                      exclusivo de PPAs Físicos
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                      }}
                      title="Fecha objetivo en calendario peninsular (permite preparar sábado, domingo y lunes)"
                    >
                      <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="date"
                        value={selectedTargetDate}
                        min={todayDateStr}
                        max={maxForecastDateStr}
                        onChange={(e) => setSelectedTargetDate(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <button
                      onClick={trainModel}
                      disabled={training || loading || deepSyncing}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      title="Sincroniza los últimos 30 días de agregados y entrena el modelo"
                    >
                      {training ? (
                        <RefreshCw className="animate-spin" size={16} />
                      ) : (
                        <Brain size={16} />
                      )}
                      {training ? 'Sincronizando y Entrenando...' : 'Sincronizar y Entrenar'}
                    </button>

                    <button
                      onClick={generateForecast}
                      disabled={loading || training || deepSyncing}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {loading ? (
                        <RefreshCw className="animate-spin" size={16} />
                      ) : (
                        <Zap size={16} />
                      )}
                      {loading
                        ? 'Calculando IA...'
                        : selectedTargetDate === defaultTomorrowDateStr
                          ? 'Generar Predicción Mañana'
                          : `Generar Predicción (${formatYmdEs(selectedTargetDate)})`}
                    </button>

                    <button
                      onClick={runDeepSync}
                      disabled={training || loading || deepSyncing}
                      className="btn btn-outline"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}
                      title="Regenerar los últimos 365 días y verificar clima histórico Open-Meteo"
                    >
                      <RefreshCw className={deepSyncing ? 'animate-spin' : ''} size={16} />
                      {deepSyncing ? 'Sincronizando 365d...' : 'Sincronización Profunda'}
                    </button>
                  </div>
                </div>

                {projectionData && projectionData.length > 0 && (
                  <div
                    className="animate-fade-in-up"
                    style={{
                      marginTop: '24px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                        }}
                      >
                        Proyección de Consumo a 12 Meses (Cartera Actual)
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {activeContracts} suministro(s) activo(s) · Total:{' '}
                        {totalProjected12m.toLocaleString('es-ES', { maximumFractionDigits: 0 })}{' '}
                        MWh
                      </span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          textAlign: 'right',
                          fontSize: '0.85rem',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: 'var(--bg-base)',
                              borderBottom: '2px solid var(--border)',
                            }}
                          >
                            <th
                              style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                              }}
                            >
                              Concepto
                            </th>
                            {projectionData.map((p: any, i: number) => (
                              <th
                                key={i}
                                style={{
                                  padding: '12px 16px',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {p.monthName}
                              </th>
                            ))}
                            <th
                              style={{
                                padding: '12px 16px',
                                fontWeight: 700,
                                color: 'var(--primary)',
                              }}
                            >
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            style={{
                              borderBottom: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              transition: 'background 0.2s',
                            }}
                            className="hover:bg-gray-50/5 dark:hover:bg-white/5"
                          >
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              Consumo Estimado (MWh)
                            </td>
                            {projectionData.map((p: any, i: number) => (
                              <td
                                key={i}
                                style={{ padding: '12px 16px', color: 'var(--text-primary)' }}
                              >
                                {p.mwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                              </td>
                            ))}
                            <td
                              style={{
                                padding: '12px 16px',
                                fontWeight: 700,
                                color: 'var(--primary)',
                              }}
                            >
                              {totalProjected12m.toLocaleString('es-ES', {
                                maximumFractionDigits: 0,
                              })}
                            </td>
                          </tr>
                          <tr
                            style={{
                              background: 'var(--bg-elevated)',
                              transition: 'background 0.2s',
                            }}
                            className="hover:bg-gray-50/5 dark:hover:bg-white/5"
                          >
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              % sobre Total 12m
                            </td>
                            {projectionData.map((p: any, i: number) => (
                              <td
                                key={i}
                                style={{ padding: '12px 16px', color: 'var(--text-primary)' }}
                              >
                                {p.percentage.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                                %
                              </td>
                            ))}
                            <td
                              style={{
                                padding: '12px 16px',
                                fontWeight: 700,
                                color: 'var(--primary)',
                              }}
                            >
                              {Math.round(
                                projectionData.reduce(
                                  (acc: number, p: any) => acc + p.percentage,
                                  0
                                )
                              )}
                              %
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {training && (
                  <div
                    className="animate-fade-in-up"
                    style={{
                      padding: '20px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>
                        Entrenando Inteligencia Artificial con histórico meteorológico...
                      </span>
                      <span style={{ color: 'var(--primary)' }}>{trainingProgress}%</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        background: 'var(--gray-alpha-100)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${trainingProgress}%`,
                          height: '100%',
                          background: 'var(--primary)',
                          transition: 'width 0.5s ease-out',
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '8px',
                        textAlign: 'center',
                      }}
                    >
                      Ponderando perfiles horarios provinciales por volumen de clientes.
                    </p>
                  </div>
                )}

                {forecastResult && (
                  <div className="animate-fade-in-up space-y-6">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        Resultados: {formatYmdEs(forecastResult.targetDate)} (
                        {forecastResult.targetDate})
                      </h4>
                      <button
                        onClick={downloadOmieCSV}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        title="Descarga los 96 cuartos de hora (Q1–Q96) expresados en MW de potencia para ofertar en OMIE"
                      >
                        <Download size={16} />
                        Exportar CSV OMIE (96Q MW)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="card-stat">
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Total Neto a Comprar OMIE
                        </span>
                        <div
                          style={{
                            fontSize: '2.2rem',
                            fontWeight: 800,
                            color: 'var(--primary)',
                            marginTop: '8px',
                          }}
                        >
                          {(forecastResult.totalPredicted / 1000).toLocaleString('es-ES', {
                            maximumFractionDigits: 2,
                          })}{' '}
                          <span
                            style={{
                              fontSize: '1rem',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                            }}
                          >
                            MWh
                          </span>
                        </div>
                        {forecastResult.totalGrossPredicted !== undefined && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            Demanda Bruta BC:{' '}
                            {((forecastResult.totalGrossPredicted || 0) / 1000).toLocaleString(
                              'es-ES',
                              { maximumFractionDigits: 2 }
                            )}{' '}
                            MWh
                          </div>
                        )}
                      </div>

                      <div className="card-stat">
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Cobertura PPA Físico
                        </span>
                        <div
                          style={{
                            fontSize: '2.2rem',
                            fontWeight: 800,
                            color: '#60A5FA',
                            marginTop: '8px',
                          }}
                        >
                          -
                          {((forecastResult.totalPpaPhysical || 0) / 1000).toLocaleString('es-ES', {
                            maximumFractionDigits: 2,
                          })}{' '}
                          <span
                            style={{
                              fontSize: '1rem',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                            }}
                          >
                            MWh
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                          }}
                        >
                          {forecastResult.activePhysicalPpasCount || 0} PPA(s) físicos activos
                          {forecastResult.activeFinancialPpasCount > 0
                            ? ` · (${forecastResult.activeFinancialPpasCount} financiero CfD excluido)`
                            : ''}
                        </div>
                      </div>

                      <div className="card-stat">
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Volumen VIP Automatizado (SDA)
                        </span>
                        <div
                          style={{
                            fontSize: '2.2rem',
                            fontWeight: 800,
                            color: 'var(--success)',
                            marginTop: '8px',
                          }}
                        >
                          {(
                            (forecastResult.vipPredictions || []).reduce(
                              (a: number, b: number) => a + b,
                              0
                            ) / 1000
                          ).toLocaleString('es-ES', { maximumFractionDigits: 2 })}{' '}
                          <span
                            style={{
                              fontSize: '1rem',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                            }}
                          >
                            MWh
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--bg-elevated)',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '850px',
                          display: 'flex',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <h4
                          style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '16px',
                          }}
                        >
                          Curva de Demanda y Compra Neta OMIE
                        </h4>
                      </div>
                      <div style={{ width: '100%', maxWidth: '850px', height: 400 }}>
                        <ResponsiveContainer>
                          <LineChart
                            data={forecastResult.finalPrediction.map((val: number, i: number) => {
                              const gross = forecastResult.grossPrediction
                                ? forecastResult.grossPrediction[i]
                                : val;
                              const vip = forecastResult.vipPredictions
                                ? forecastResult.vipPredictions[i]
                                : 0;
                              const ppaFis = forecastResult.ppaPhysicalPredictions
                                ? forecastResult.ppaPhysicalPredictions[i]
                                : 0;
                              return {
                                hora: `${String(i + 1).padStart(2, '0')}:00`,
                                'Resto (IA)': parseFloat(((gross - vip) / 1000).toFixed(3)),
                                'VIP/VE (SDA)': parseFloat((vip / 1000).toFixed(3)),
                                'PPA Físico': parseFloat((ppaFis / 1000).toFixed(3)),
                                'Total OMIE': parseFloat((val / 1000).toFixed(3)),
                              };
                            })}
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="hora"
                              stroke="var(--text-muted)"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.1))]}
                              stroke="var(--text-muted)"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(val) => `${val} MW`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                              }}
                              itemStyle={{ color: 'var(--text-primary)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line
                              type="monotone"
                              dataKey="Total OMIE"
                              stroke="#3b82f6"
                              strokeWidth={4}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="PPA Físico"
                              stroke="#a855f7"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="Resto (IA)"
                              stroke="var(--text-muted)"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="VIP/VE (SDA)"
                              stroke="var(--success)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div
                      style={{
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 20px',
                          background: 'var(--bg-base)',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Desglose de Potencia a Ofertar en OMIE (MW)
                          </span>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-muted)',
                              marginLeft: '10px',
                            }}
                          >
                            OMIE exige potencia en <strong>MW</strong> por cuarto de hora (no MWh de
                            energía)
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '3px',
                            gap: '4px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setTableResolution('96q')}
                            style={{
                              padding: '5px 12px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              background:
                                tableResolution === '96q' ? 'var(--primary)' : 'transparent',
                              color:
                                tableResolution === '96q' ? '#fff' : 'var(--text-muted)',
                            }}
                          >
                            96 Cuartos OMIE (Q1–Q96 MW)
                          </button>
                          <button
                            type="button"
                            onClick={() => setTableResolution('24h')}
                            style={{
                              padding: '5px 12px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              background:
                                tableResolution === '24h' ? 'var(--primary)' : 'transparent',
                              color:
                                tableResolution === '24h' ? '#fff' : 'var(--text-muted)',
                            }}
                          >
                            Resumen 24 Horas (MW)
                          </button>
                        </div>
                      </div>

                      <div style={{ maxHeight: tableResolution === '96q' ? '520px' : 'none', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead
                            style={{
                              background: 'var(--bg-elevated)',
                              borderBottom: '1px solid var(--border)',
                              position: 'sticky',
                              top: 0,
                              zIndex: 1,
                            }}
                          >
                            <tr>
                              <th
                                style={{
                                  padding: '14px 20px',
                                  textAlign: 'left',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {tableResolution === '96q' ? 'Cuarto de Hora (Q1–Q96)' : 'Hora'}
                              </th>
                              <th
                                style={{
                                  padding: '14px 20px',
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Demanda Resto IA (MW)
                              </th>
                              <th
                                style={{
                                  padding: '14px 20px',
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Demanda VIP/VE (MW)
                              </th>
                              <th
                                style={{
                                  padding: '14px 20px',
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#60A5FA',
                                  textTransform: 'uppercase',
                                }}
                              >
                                PPA Físico (MW)
                              </th>
                              <th
                                style={{
                                  padding: '14px 20px',
                                  textAlign: 'right',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  color: 'var(--primary)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                OFERTA OMIE (MW)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableResolution === '96q'
                              ? (() => {
                                  const quarterNetMw = interpolateHourlyKwhToQuarterlyMw(
                                    forecastResult.finalPrediction
                                  );
                                  return quarterNetMw.map((netMw: number, qIdx: number) => {
                                    const hIdx = Math.floor(qIdx / 4);
                                    const gross = forecastResult.grossPrediction
                                      ? forecastResult.grossPrediction[hIdx]
                                      : forecastResult.finalPrediction[hIdx];
                                    const vip = forecastResult.vipPredictions
                                      ? forecastResult.vipPredictions[hIdx]
                                      : 0;
                                    const restoMw = (gross - vip) / 1000;
                                    const vipMw = vip / 1000;
                                    const ppaFisMw = forecastResult.ppaPhysicalPredictions
                                      ? forecastResult.ppaPhysicalPredictions[hIdx] / 1000
                                      : 0;
                                    return (
                                      <tr
                                        key={qIdx}
                                        style={{ borderBottom: '1px solid var(--border)' }}
                                      >
                                        <td
                                          style={{
                                            padding: '10px 20px',
                                            fontSize: '0.84rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                          }}
                                        >
                                          {formatQuarterLabel(qIdx)}
                                        </td>
                                        <td
                                          style={{
                                            padding: '10px 20px',
                                            fontSize: '0.84rem',
                                            color: 'var(--text-muted)',
                                            textAlign: 'right',
                                          }}
                                        >
                                          {restoMw.toFixed(3)}
                                        </td>
                                        <td
                                          style={{
                                            padding: '10px 20px',
                                            fontSize: '0.84rem',
                                            color: 'var(--success)',
                                            textAlign: 'right',
                                            fontWeight: 500,
                                          }}
                                        >
                                          {vipMw.toFixed(3)}
                                        </td>
                                        <td
                                          style={{
                                            padding: '10px 20px',
                                            fontSize: '0.84rem',
                                            color: '#60A5FA',
                                            textAlign: 'right',
                                            fontWeight: 500,
                                          }}
                                        >
                                          -{ppaFisMw.toFixed(3)}
                                        </td>
                                        <td
                                          style={{
                                            padding: '10px 20px',
                                            fontSize: '0.84rem',
                                            color: 'var(--primary)',
                                            textAlign: 'right',
                                            fontWeight: 800,
                                          }}
                                        >
                                          {netMw.toFixed(1)}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()
                              : forecastResult.finalPrediction.map((val: number, i: number) => {
                                  const gross = forecastResult.grossPrediction
                                    ? forecastResult.grossPrediction[i]
                                    : val;
                                  const vip = forecastResult.vipPredictions
                                    ? forecastResult.vipPredictions[i]
                                    : 0;
                                  const resto = gross - vip;
                                  const ppaFis = forecastResult.ppaPhysicalPredictions
                                    ? forecastResult.ppaPhysicalPredictions[i]
                                    : 0;
                                  return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td
                                        style={{
                                          padding: '12px 20px',
                                          fontSize: '0.85rem',
                                          fontWeight: 600,
                                          color: 'var(--text-primary)',
                                        }}
                                      >
                                        {String(i + 1).padStart(2, '0')}:00
                                      </td>
                                      <td
                                        style={{
                                          padding: '12px 20px',
                                          fontSize: '0.85rem',
                                          color: 'var(--text-muted)',
                                          textAlign: 'right',
                                        }}
                                      >
                                        {(resto / 1000).toFixed(3)}
                                      </td>
                                      <td
                                        style={{
                                          padding: '12px 20px',
                                          fontSize: '0.85rem',
                                          color: 'var(--success)',
                                          textAlign: 'right',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {(vip / 1000).toFixed(3)}
                                      </td>
                                      <td
                                        style={{
                                          padding: '12px 20px',
                                          fontSize: '0.85rem',
                                          color: '#60A5FA',
                                          textAlign: 'right',
                                          fontWeight: 500,
                                        }}
                                      >
                                        -{(ppaFis / 1000).toFixed(3)}
                                      </td>
                                      <td
                                        style={{
                                          padding: '12px 20px',
                                          fontSize: '0.85rem',
                                          color: 'var(--primary)',
                                          textAlign: 'right',
                                          fontWeight: 800,
                                        }}
                                      >
                                        {(val / 1000).toFixed(3)}
                                      </td>
                                    </tr>
                                  );
                                })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px 20px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <strong>ℹ️ Nota sobre unidades OMIE (MW), métodos de cálculo y PPAs:</strong>
                      <br />
                      OMIE exige que las ofertas cuarto-horarias (<code>Q1..Q96</code>) se envíen
                      estrictamente en <strong>MW de potencia</strong> (no en MWh de energía; la
                      energía diaria acumulada en MWh equivale a{' '}
                      <code>Σ Potencia_MW(q) × 0,25 h</code>). Los suministros{' '}
                      <strong>VE</strong> y <strong>VIP</strong> (&gt; 100 MWh/año) se estiman por{' '}
                      <strong>SDA</strong>, mientras que Hogares y PYMEs se estiman con Árboles de
                      Decisión (IA) y previsión meteorológica provincial. Únicamente se descuentan
                      los <strong>PPAs Físicos</strong> (entrega bilateral directa); los PPAs
                      Financieros (CfD) jamás alteran la oferta física en OMIE.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
