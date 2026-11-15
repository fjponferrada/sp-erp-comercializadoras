'use client';

import React, { useMemo, useState } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { Calendar } from 'lucide-react';
import type { EconomicAnalysisRow } from '@/app/actions/analysisActions';

type HorizonKey = '12M' | '24M' | 'YTD' | 'ALL';

const HORIZON_OPTIONS: Array<{ key: HorizonKey; label: string }> = [
  { key: '12M', label: 'Últ. 12 meses' },
  { key: '24M', label: 'Últ. 24 meses' },
  { key: 'YTD', label: 'Año actual' },
  { key: 'ALL', label: 'Todo el histórico' },
];

function formatEur(val: number, decimals = 2): string {
  return (Number(val) || 0).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompactAxisEur(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}M€`;
  }
  if (abs >= 1_000) {
    return `${Math.round(v / 1_000).toLocaleString('es-ES')}k€`;
  }
  return `${Math.round(v)}€`;
}

export default function AnalysisDashboard({ data }: { data: EconomicAnalysisRow[] }) {
  const [horizon, setHorizon] = useState<HorizonKey>('ALL');

  const filteredData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    if (horizon === 'ALL') return data;
    if (horizon === '12M') return data.slice(-12);
    if (horizon === '24M') return data.slice(-24);
    const currentYearPrefix = `${new Date().getFullYear()}-`;
    const ytd = data.filter((d) => d.month.startsWith(currentYearPrefix));
    return ytd.length > 0 ? ytd : data.slice(-12);
  }, [data, horizon]);

  const summary = useMemo(() => {
    let factEur = 0;
    let factKwh = 0;
    let margenEur = 0;
    let altas = 0;
    let bajas = 0;

    for (const row of filteredData) {
      factEur += row.facturacionEur || 0;
      factKwh += row.facturacionMwh || 0;
      margenEur += row.margenEur || 0;
      altas += row.altas || 0;
      bajas += row.bajas || 0;
    }

    const energiaMwh = factKwh / 1000;
    const precioMedioEurMwh = energiaMwh > 0 ? factEur / energiaMwh : 0;
    const margenMedioEurMwh = energiaMwh > 0 ? margenEur / energiaMwh : 0;

    return {
      factEur,
      energiaMwh,
      margenEur,
      precioMedioEurMwh,
      margenMedioEurMwh,
      altas,
      bajas,
    };
  }, [filteredData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra de horizonte temporal */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Calendar size={15} color="var(--lime)" />
          <span>
            Mostrando <strong style={{ color: 'var(--text-primary)' }}>{filteredData.length}</strong> meses
            {filteredData.length > 0
              ? ` (${filteredData[0].month} → ${filteredData[filteredData.length - 1].month})`
              : ''}
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            gap: '4px',
            padding: '4px',
            borderRadius: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          {HORIZON_OPTIONS.map((opt) => {
            const active = horizon === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setHorizon(opt.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.75rem',
                  fontWeight: active ? 700 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: active ? 'rgba(222, 255, 154, 0.14)' : 'transparent',
                  color: active ? 'var(--lime)' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolución de Cartera (Contratos y MWh con línea base 0 sincronizada) */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Evolución de Cartera (Contratos y MWh)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Suministros netos activos por CUPS (carencia 30d) y volumen anualizado en cartera
            </p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  domain={[0, 'auto']}
                  allowDecimals={false}
                  stroke="#38bdf8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(Number(v) || 0).toLocaleString('es-ES')}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 'auto']}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(Number(v) || 0).toLocaleString('es-ES')}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload as EconomicAnalysisRow | undefined;
                    const growthPct = (Number(row?.crecimientoMes ?? 0) * 100).toFixed(2);
                    return (
                      <div
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '0.75rem',
                          padding: '12px 16px',
                          color: '#f8fafc',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                          minWidth: '240px',
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 700,
                            margin: '0 0 8px',
                            color: '#fff',
                            borderBottom: '1px solid #334155',
                            paddingBottom: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>{label}</span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: Number(growthPct) >= 0 ? '#10b981' : '#f43f5e',
                            }}
                          >
                            {Number(growthPct) >= 0 ? '+' : ''}
                            {growthPct}% MWh
                          </span>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Contratos Activos:</span>
                            <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                              {(row?.contratosActivos ?? 0).toLocaleString('es-ES')}{' '}
                              <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: 400 }}>
                                (+{row?.altas ?? 0} / -{row?.bajas ?? 0})
                              </span>
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#818cf8', fontWeight: 600 }}>Cartera Viva MWh:</span>
                            <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                              {Number(row?.mwhActivos ?? 0).toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              MWh
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#10b981' }}>Altas del mes:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              +{Number(row?.mwhAltas ?? 0).toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              MWh
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#f43f5e' }}>Bajas del mes:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              -{Number(row?.mwhBajas ?? 0).toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              MWh
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '0.8rem' }} />
                <Bar yAxisId="right" dataKey="mwhAltas" name="Altas MWh" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar yAxisId="right" dataKey="mwhBajas" name="Bajas MWh" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="contratosActivos"
                  name="Contratos Activos"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#38bdf8', strokeWidth: 1.5, stroke: '#0f172a' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mwhActivos"
                  name="Total Activos MWh"
                  stroke="#818cf8"
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: '#818cf8', strokeWidth: 1.5, stroke: '#0f172a' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Facturación B.I. vs Margen Comercial */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Facturación B.I. y Margen Comercial (€)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Base Imponible neta de abonos (sin IVA ni penalizaciones) frente a margen comercial real
            </p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompactAxisEur(Number(v) || 0)}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload as EconomicAnalysisRow | undefined;
                    const energiaMwh = row?.energiaFacturadaMwh ?? (row?.facturacionMwh || 0) / 1000;
                    const precioMedio =
                      row?.precioMedioEurMwh ?? (row?.eurPerMwh ? row.eurPerMwh * 1000 : 0);
                    const margenMwh =
                      row?.margenEurMwh ?? (energiaMwh > 0 ? (row?.margenEur || 0) / energiaMwh : 0);
                    return (
                      <div
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '0.75rem',
                          padding: '12px 16px',
                          color: '#f8fafc',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                          minWidth: '250px',
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 700,
                            margin: '0 0 8px',
                            color: '#fff',
                            borderBottom: '1px solid #334155',
                            paddingBottom: '6px',
                          }}
                        >
                          {label}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Facturación B.I.:</span>
                            <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                              {formatEur(row?.facturacionEur || 0)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94a3b8' }}>Energía Facturada:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {energiaMwh.toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              MWh
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#cbd5e1' }}>Precio Medio:</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {formatEur(precioMedio)}/MWh
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '16px',
                              borderTop: '1px solid #1e293b',
                              paddingTop: '5px',
                              marginTop: '2px',
                            }}
                          >
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Margen Comercial:</span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                                color: (row?.margenEur || 0) >= 0 ? '#f59e0b' : '#f43f5e',
                              }}
                            >
                              {formatEur(row?.margenEur || 0)}
                            </span>
                          </div>
                          {energiaMwh > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                              <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>Margen Unitario:</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.76rem', color: '#cbd5e1' }}>
                                {formatEur(margenMwh)}/MWh ({((row?.margenPercent || 0) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '0.8rem' }} />
                <Area
                  type="monotone"
                  dataKey="facturacionEur"
                  name="Facturación B.I. (sin IVA)"
                  fill="#38bdf8"
                  stroke="#38bdf8"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Bar
                  dataKey="margenEur"
                  name="Margen Comercial"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabla Detallada de Rendimiento Histórico Mensual */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Rendimiento Histórico Mensual
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Desglose mensual de facturación (Base Imponible), energía liquidada, margen comercial y rotación de cartera
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ padding: '14px 20px' }}>Mes</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Contratos Activos</th>
                <th style={{ padding: '14px 20px', textAlign: 'center' }}>Altas / Bajas</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Cartera Viva</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Facturación B.I.</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Energía Fact.</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Precio Medio</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Margen Comercial</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Var. Cartera</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 && (
                <tr
                  style={{
                    background: 'rgba(222, 255, 154, 0.05)',
                    borderBottom: '2px solid var(--border)',
                    fontWeight: 700,
                  }}
                >
                  <td style={{ padding: '14px 20px', color: 'var(--lime)', fontWeight: 700 }}>
                    TOTAL PERIODO
                  </td>
                  <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    —
                  </td>
                  <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'center' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>+{summary.altas}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>-{summary.bajas}</span>
                  </td>
                  <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    —
                  </td>
                  <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--info)', fontWeight: 700 }}>
                    {formatEur(summary.factEur)}
                  </td>
                  <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>
                    {summary.energiaMwh.toLocaleString('es-ES', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    MWh
                  </td>
                  <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700 }}>
                    {summary.energiaMwh > 0 ? `${formatEur(summary.precioMedioEurMwh)}/MWh` : '—'}
                  </td>
                  <td
                    className="mono-cell"
                    style={{
                      padding: '14px 20px',
                      textAlign: 'right',
                      color: summary.margenEur >= 0 ? 'var(--warning)' : 'var(--danger)',
                      fontWeight: 700,
                    }}
                  >
                    <div>{formatEur(summary.margenEur)}</div>
                    {summary.energiaMwh > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {formatEur(summary.margenMedioEurMwh)}/MWh
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                </tr>
              )}

              {[...filteredData].reverse().map((row) => {
                const energiaMwh = row.energiaFacturadaMwh ?? (row.facturacionMwh || 0) / 1000;
                const precioMedio =
                  row.precioMedioEurMwh ?? (row.eurPerMwh ? row.eurPerMwh * 1000 : 0);
                const margenUnit =
                  row.margenEurMwh ?? (energiaMwh > 0 ? row.margenEur / energiaMwh : 0);
                const growthPct = (row.crecimientoMes || 0) * 100;

                return (
                  <tr key={row.month}>
                    <td className="mono-cell" style={{ padding: '14px 20px', fontWeight: 600, color: '#fff' }}>
                      {row.month}
                    </td>
                    <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}>
                      {row.contratosActivos.toLocaleString('es-ES')}
                    </td>
                    <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{row.altas}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{row.bajas}</span>
                    </td>
                    <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#818cf8' }}>
                      {row.mwhActivos.toLocaleString('es-ES', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      MWh
                    </td>
                    <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500, color: 'var(--info)' }}>
                      {formatEur(row.facturacionEur)}
                    </td>
                    <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {energiaMwh.toLocaleString('es-ES', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      MWh
                    </td>
                    <td className="mono-cell" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500, color: '#e2e8f0' }}>
                      {energiaMwh > 0 ? formatEur(precioMedio) : '—'}
                    </td>
                    <td
                      className="mono-cell"
                      style={{
                        padding: '14px 20px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: row.margenEur >= 0 ? 'var(--warning)' : 'var(--danger)',
                      }}
                    >
                      <div>{formatEur(row.margenEur)}</div>
                      {energiaMwh > 0 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {formatEur(margenUnit)}/MWh
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <span
                        className={growthPct >= 0 ? 'badge badge-active' : 'badge badge-danger'}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {growthPct >= 0 ? '+' : ''}
                        {growthPct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay datos suficientes para generar el análisis económico. Sube facturas o activa contratos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
