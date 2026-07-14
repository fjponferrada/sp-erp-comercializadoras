'use client';

import React, { useState, Fragment } from 'react';
import { Calculator, Loader2, Download } from 'lucide-react';
import Topbar from '@/components/Topbar';

interface IEResult {
  zona: string;
  tipo: number;
  baseSujeta: number;
  impuestoBase: number;
  consumoMinimo: number;
  impuestoMinimo: number;
  total: number;
  isMinApplied?: boolean;
}

export default function ElectricoClient() {
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState('2026');
  const [quarter, setQuarter] = useState('1');
  const [results, setResults] = useState<IEResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/impuestos/electrico?year=${year}&quarter=${quarter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular');
      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTxt = (zona?: string) => {
    let url = `/api/impuestos/electrico/export?year=${year}&quarter=${quarter}`;
    if (zona) url += `&zona=${encodeURIComponent(zona)}`;
    window.location.href = url;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Impuesto Eléctrico" subtitle="Gestión y liquidación del Impuesto Especial sobre la Electricidad" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Selector */}
        <div className="card animate-fade-in-up" style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Año</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="form-input"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 300px' }}>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Trimestre</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="form-input"
            >
              <option value="1">Primer Trimestre (Ene - Mar)</option>
              <option value="2">Segundo Trimestre (Abr - Jun)</option>
              <option value="3">Tercer Trimestre (Jul - Sep)</option>
              <option value="4">Cuarto Trimestre (Oct - Dic)</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'flex', gap: '16px' }}>
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="btn-primary"
              style={{ padding: '8px 24px', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-black" /> : <Calculator className="w-5 h-5" />}
              {loading ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Calculator className="text-[var(--lime)] w-5 h-5" />
              Desglose Impuesto Eléctrico (T{quarter} {year})
            </h3>
          </div>
          
          {results.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No se encontraron facturas para este periodo.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zona (Agencia)</th>
                    <th style={{ textAlign: 'center' }}>Límite Mínimo</th>
                    <th style={{ textAlign: 'right' }}>Tipo Aplicado (%)</th>
                    <th style={{ textAlign: 'right' }}>Base Sujeta (€)</th>
                    <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Impuesto Base (€)</th>
                    <th style={{ textAlign: 'right', borderLeft: '1px solid var(--border)' }}>Consumo Mínimo (MWh)</th>
                    <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Impuesto Mínimo (€)</th>
                    <th style={{ textAlign: 'right', color: 'var(--lime)' }}>Total Impuesto (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    results.reduce((acc, row) => {
                      if (!acc[row.zona]) acc[row.zona] = [];
                      acc[row.zona].push(row);
                      return acc;
                    }, {} as Record<string, IEResult[]>)
                  ).map(([zona, rows]) => (
                    <Fragment key={zona}>
                      {/* Cabecera de Zona */}
                      <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderTop: '2px solid var(--border)' }}>
                        <td colSpan={8} style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--lime)', fontSize: '0.95rem' }}>
                              📍 Agencia Tributaria: {zona}
                            </span>
                            <button
                              onClick={() => handleExportTxt(zona)}
                              className="btn-secondary"
                              style={{ padding: '6px 16px', height: '36px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'white', fontSize: '0.85rem', borderRadius: '6px' }}
                            >
                              <Download className="w-4 h-4" />
                              TXT {zona}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Filas de la Zona */}
                      {rows.map((row, idx) => (
                        <tr key={`${zona}-${idx}`}>
                          <td style={{ fontWeight: 500, color: '#fff', paddingLeft: '32px' }}>{row.zona}</td>
                          <td style={{ textAlign: 'center' }}>
                            {row.isMinApplied ? (
                              <span className="badge badge-draft" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Sí</span>
                            ) : (
                              <span className="badge badge-active">No</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{row.isMinApplied ? '-' : `${formatNumber(row.tipo)}%`}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{row.isMinApplied ? '-' : formatCurrency(row.baseSujeta)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.isMinApplied ? '-' : formatCurrency(row.impuestoBase)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', borderLeft: '1px solid var(--border)' }}>{!row.isMinApplied ? '-' : formatNumber(row.consumoMinimo) + ' MWh'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{!row.isMinApplied ? '-' : formatCurrency(row.impuestoMinimo)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--lime)' }}>{formatCurrency(row.total)}</td>
                        </tr>
                      ))}
                      {/* Subtotal por Zona */}
                      <tr style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
                        <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', paddingRight: '24px' }}>Subtotal {zona}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem' }}>{formatCurrency(rows.reduce((acc, r) => acc + r.baseSujeta, 0))}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatCurrency(rows.reduce((acc, r) => acc + r.impuestoBase, 0))}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', borderLeft: '1px solid var(--border)' }}>{formatNumber(rows.reduce((acc, r) => acc + r.consumoMinimo, 0))} MWh</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatCurrency(rows.reduce((acc, r) => acc + r.impuestoMinimo, 0))}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--lime)', fontWeight: 'bold' }}>{formatCurrency(rows.reduce((acc, r) => acc + r.total, 0))}</td>
                      </tr>
                    </Fragment>
                  ))}
                  
                  {/* Totales Globales */}
                  <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)', fontWeight: 'bold' }}>
                    <td colSpan={3}>TOTAL GENERAL</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(results.reduce((acc, r) => acc + r.baseSujeta, 0))}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {formatCurrency(results.reduce((acc, r) => acc + r.impuestoBase, 0))}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', borderLeft: '1px solid var(--border)' }}>
                      {formatNumber(results.reduce((acc, r) => acc + r.consumoMinimo, 0))} MWh
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {formatCurrency(results.reduce((acc, r) => acc + r.impuestoMinimo, 0))}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--lime)' }}>
                      {formatCurrency(results.reduce((acc, r) => acc + r.total, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
