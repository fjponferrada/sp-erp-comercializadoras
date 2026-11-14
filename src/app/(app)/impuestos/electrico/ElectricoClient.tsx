'use client';

import React, { useState, Fragment, useMemo } from 'react';
import { Calculator, Loader2, Download, AlertTriangle, Copy, Check, Info } from 'lucide-react';
import Topbar from '@/components/Topbar';

interface IEResult {
  zona: string;
  rateBucket: '5.11' | '3.8' | '2.5' | '0.5';
  tipo: number;
  baseImponibleBruta: number;
  baseSujeta: number;
  impuestoBase: number;
  consumoMinimo: number;
  impuestoMinimo: number;
  exemptMwh: number;
  total: number;
  isMinApplied?: boolean;
  isHistoricalRate?: boolean;
}

interface ZoneCuadroLiquidacion {
  zona: string;
  rateBucket: string;
  numericRate: number;
  casilla1BaseImponible: number;
  casilla2BaseLiquidable: number;
  casilla3CuotaIntegra: number;
  casilla4CantidadMwh: number;
  casilla5CuotaMinima: number;
  casilla6TotalIngresar: number;
  exemptCantidadMwh: number;
  exemptBaseImponible: number;
  centAdjustmentEur: number;
  rawCasilla2BeforeAdjust: number;
  hasNegativeMinQuota: boolean;
  invoiceCount: number;
  txtLines: string[];
}

interface HistoricalZoneInfo {
  zona: string;
  rateBucket: '5.11' | '3.8' | '2.5' | '0.5';
  count: number;
  totalQuota: number;
}

export default function ElectricoClient() {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const maxY = Math.max(2027, currentYear + 1);
    const list: string[] = [];
    for (let y = maxY; y >= 2021; y--) list.push(String(y));
    return list;
  }, [currentYear]);

  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(String(Math.min(Math.max(currentYear, 2021), 2027)));
  const [quarter, setQuarter] = useState('1');
  const [scope, setScope] = useState<'brand' | 'company'>('brand');
  const [mode, setMode] = useState<'oficial' | 'neteado'>('oficial');
  const [adjustCents, setAdjustCents] = useState(true);

  const [results, setResults] = useState<IEResult[] | null>(null);
  const [cuadrosByZone, setCuadrosByZone] = useState<Record<string, ZoneCuadroLiquidacion>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cieErrors, setCieErrors] = useState<string[]>([]);
  const [historicalZones, setHistoricalZones] = useState<HistoricalZoneInfo[]>([]);
  const [declarantCie, setDeclarantCie] = useState('');
  const [zoneCieOverrides, setZoneCieOverrides] = useState<Record<string, string>>({});
  const [entityMeta, setEntityMeta] = useState<{ companyName: string; brandName: string; companyBrandsCount: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (num: number, decimals = 2) => {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
  };

  // Formato exacto exigido en casillas web AEAT: sin puntos de miles y con coma decimal (evita error 39621)
  const formatAeatInput = (num: number, decimals = 2) => {
    const clean = Object.is(num, -0) ? 0 : num;
    return clean.toFixed(decimals).replace('.', ',');
  };

  const copyToClipboard = (val: string, key: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1500);
  };

  const fetchCalculation = async (
    overrideMode?: 'oficial' | 'neteado',
    overrideScope?: 'brand' | 'company',
    overrideAdjust?: boolean
  ) => {
    const effMode = overrideMode ?? mode;
    const effScope = overrideScope ?? scope;
    const effAdjust = overrideAdjust ?? adjustCents;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year,
        quarter,
        scope: effScope,
        mode: effMode,
        adjustCents: String(effAdjust),
      });
      const res = await fetch(`/api/impuestos/electrico?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular el Modelo 560');

      setResults(data.results || []);
      setCuadrosByZone(data.cuadrosByZone || {});
      setWarnings(data.warnings || []);
      setCieErrors(data.cieErrors || []);
      setHistoricalZones(data.historicalZones || []);
      setDeclarantCie(data.declarantCie || '');
      setEntityMeta({
        companyName: data.companyName || '',
        brandName: data.brandName || '',
        companyBrandsCount: data.companyBrandsCount || 1,
      });

      // Inicializar CIE por zona (por defecto el CIE estatal en España)
      const initialOverrides: Record<string, string> = {};
      for (const z of Object.keys(data.cuadrosByZone || {})) {
        initialOverrides[z] = z === 'España' ? (data.declarantCie || '') : (zoneCieOverrides[z] ?? data.declarantCie ?? '');
      }
      setZoneCieOverrides(initialOverrides);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTxt = (zona?: string, rate: string = '5.11') => {
    const params = new URLSearchParams({
      year,
      quarter,
      scope,
      mode,
      adjustCents: String(adjustCents),
      rate,
    });
    if (zona) {
      params.set('zona', zona);
      if (zoneCieOverrides[zona] !== undefined) {
        params.set('cie', zoneCieOverrides[zona]);
      }
    }
    window.location.href = `/api/impuestos/electrico/export?${params.toString()}`;
  };

  const groupedResults = useMemo(() => {
    if (!results) return {};
    return results.reduce((acc, row) => {
      if (!acc[row.zona]) acc[row.zona] = [];
      acc[row.zona].push(row);
      return acc;
    }, {} as Record<string, IEResult[]>);
  }, [results]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Impuesto Eléctrico (Modelo 560)"
        subtitle="Autoliquidación y exportación oficial AEAT / Haciendas Forales (Orden HAC/172/2021)"
      />

      <div
        style={{
          padding: '24px 32px',
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Filtros y Configuración */}
        <div
          className="card animate-fade-in-up"
          style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 140px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Año
              </label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="form-input">
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 240px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Trimestre
              </label>
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="form-input">
                <option value="1">Primer Trimestre (1T: Ene - Mar)</option>
                <option value="2">Segundo Trimestre (2T: Abr - Jun)</option>
                <option value="3">Tercer Trimestre (3T: Jul - Sep)</option>
                <option value="4">Cuarto Trimestre (4T: Oct - Dic)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 240px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Ámbito Societario
              </label>
              <select
                value={scope}
                onChange={(e) => {
                  const next = e.target.value as 'brand' | 'company';
                  setScope(next);
                  if (results) fetchCalculation(mode, next, adjustCents);
                }}
                className="form-input"
              >
                <option value="brand">Marca activa seleccionada</option>
                <option value="company">Toda la Comercializadora (NIF Sociedad)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 280px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Modo Exportación TXT (Sede AEAT)
              </label>
              <select
                value={mode}
                onChange={(e) => {
                  const next = e.target.value as 'oficial' | 'neteado';
                  setMode(next);
                  if (results) fetchCalculation(next, scope, adjustCents);
                }}
                className="form-input"
              >
                <option value="oficial">Oficial AEAT (Desdoble Art. 99.1 / 99.2 y Abonos)</option>
                <option value="neteado">Contingencia AEAT (Netear abonos/mínimos - Err. 39652)</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => fetchCalculation()}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 24px', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
                {loading ? 'Calculando...' : 'Calcular'}
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border)',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={adjustCents}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAdjustCents(next);
                  if (results) fetchCalculation(mode, scope, next);
                }}
              />
              <span>
                Ajustar automáticamente céntimos de Base Liquidable para evitar rechazo por truncamiento en Sede AEAT (Error 39641)
              </span>
            </label>

            {entityMeta && (
              <span>
                Sociedad: <strong style={{ color: 'var(--text-primary)' }}>{entityMeta.companyName}</strong>
                {' · '}CIE Estatal: <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{declarantCie || 'NO CONFIGURADO'}</strong>
                {entityMeta.companyBrandsCount > 1 && scope === 'brand' && (
                  <span style={{ marginLeft: '8px', color: 'var(--warning, #f59e0b)' }}>
                    (Mostrando marca {entityMeta.brandName}; la sociedad tiene {entityMeta.companyBrandsCount} marcas)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Avisos fiscales y validación preventiva de CIEs */}
        {(warnings.length > 0 || cieErrors.length > 0) && (
          <div
            className="card animate-fade-in-up"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #f59e0b',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#f59e0b', fontSize: '0.9rem' }}>
              <AlertTriangle className="w-4 h-4" />
              Control Preventivo de Validación AEAT (Modelo 560)
            </div>

            {warnings.map((w, i) => (
              <div key={`w-${i}`} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                • {w}
              </div>
            ))}

            {historicalZones.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {historicalZones.map((hz, i) => (
                  <button
                    key={`hz-${i}`}
                    onClick={() => handleExportTxt(hz.zona, hz.rateBucket)}
                    className="btn-secondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar TXT separado {hz.zona} ({hz.rateBucket}% · {hz.count} fact.)
                  </button>
                ))}
              </div>
            )}

            {cieErrors.length > 0 && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '0.8rem',
                  color: '#f87171',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  Suministros con exención/reducción cuyo NIF o CIE rechazaría el validador AEAT ({cieErrors.length}):
                </div>
                {cieErrors.slice(0, 10).map((ce, idx) => (
                  <div key={`ce-${idx}`} style={{ fontFamily: 'monospace' }}>
                    - {ce}
                  </div>
                ))}
                {cieErrors.length > 10 && <div>... y {cieErrors.length - 10} más. Edítalos en Puntos de Suministro.</div>}
              </div>
            )}
          </div>
        )}

        {/* Resultados y Cuadros de Liquidación AEAT */}
        {results && (
          <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Calculator className="text-[var(--lime)] w-5 h-5" />
                Desglose Impuesto Eléctrico (T{quarter} {year})
              </h3>
            </div>

            {results.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No se encontraron facturas con hecho imponible eléctrico para este periodo.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zona (Agencia)</th>
                      <th style={{ textAlign: 'center' }}>Mínimo Art. 99.2</th>
                      <th style={{ textAlign: 'right' }}>Tipo (%)</th>
                      <th style={{ textAlign: 'right' }}>Base Imponible Bruta (€)</th>
                      <th style={{ textAlign: 'right' }}>Base Liquidable (€)</th>
                      <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Cuota Íntegra (€)</th>
                      <th style={{ textAlign: 'right', borderLeft: '1px solid var(--border)' }}>Consumo Mín. / Exento (MWh)</th>
                      <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Cuota Mínima (€)</th>
                      <th style={{ textAlign: 'right', color: 'var(--lime)' }}>Total Impuesto (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedResults).map(([zona, rows]) => {
                      const cuadro = cuadrosByZone[zona];
                      return (
                        <Fragment key={zona}>
                          {/* Cabecera de Zona + Cuadro de Liquidación Oficial AEAT Casillas (1)-(6) */}
                          <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)' }}>
                            <td colSpan={9} style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                  <div>
                                    <span style={{ fontWeight: 700, color: 'var(--lime)', fontSize: '0.98rem' }}>
                                      📍 Agencia Tributaria: {zona}
                                    </span>
                                    {zona === 'España' && (
                                      <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        (Incluye Península, Baleares, Canarias, Ceuta y Melilla — Art. 91.1 LIIEE)
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CIE {zona}:</span>
                                      <input
                                        type="text"
                                        maxLength={13}
                                        placeholder="CIE 13 caract. (opcional)"
                                        value={zoneCieOverrides[zona] ?? ''}
                                        onChange={(e) =>
                                          setZoneCieOverrides((prev) => ({
                                            ...prev,
                                            [zona]: e.target.value.toUpperCase().trim(),
                                          }))
                                        }
                                        className="form-input"
                                        style={{ width: '165px', height: '34px', fontSize: '0.8rem', fontFamily: 'monospace', padding: '4px 8px' }}
                                      />
                                    </div>

                                    <button
                                      onClick={() => handleExportTxt(zona, '5.11')}
                                      className="btn-secondary"
                                      style={{
                                        padding: '6px 16px',
                                        height: '34px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: 'var(--bg-base)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.83rem',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      <Download className="w-4 h-4" />
                                      Descargar TXT {zona} ({cuadro?.txtLines?.length || 0} líneas)
                                    </button>
                                  </div>
                                </div>

                                {/* Cuadro oficial de Casillas (1) a (6) para teclear en Sede AEAT sin puntos */}
                                {cuadro && (
                                  <div
                                    style={{
                                      padding: '12px 16px',
                                      borderRadius: '8px',
                                      background: 'var(--bg-base)',
                                      border: '1px solid var(--border)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Cuadro de Liquidación Modelo 560 ({zona} — Tipo 5,11269632%) · Valores listos para copiar sin puntos de miles:
                                      </span>
                                      {cuadro.centAdjustmentEur !== 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontFamily: 'monospace' }}>
                                          Ajuste redondeo AEAT en Base: {cuadro.centAdjustmentEur > 0 ? '+' : ''}
                                          {formatNumber(cuadro.centAdjustmentEur)} € (Bruta: {formatNumber(cuadro.rawCasilla2BeforeAdjust)} €)
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                                        gap: '8px',
                                      }}
                                    >
                                      {[
                                        { id: '1', label: 'Casilla (1) Base imponible', val: formatAeatInput(cuadro.casilla1BaseImponible, 2) },
                                        { id: '2', label: 'Casilla (2) Base liquidable', val: formatAeatInput(cuadro.casilla2BaseLiquidable, 2) },
                                        { id: '3', label: 'Casilla (3) Cuota íntegra', val: formatAeatInput(cuadro.casilla3CuotaIntegra, 2) },
                                        { id: '4', label: 'Casilla (4) Cantidad (MWh)', val: formatAeatInput(cuadro.casilla4CantidadMwh, 3) },
                                        { id: '5', label: 'Casilla (5) Cuota mínima', val: formatAeatInput(cuadro.casilla5CuotaMinima, 2) },
                                        { id: '6', label: 'Casilla (6) Total a ingresar', val: formatAeatInput(cuadro.casilla6TotalIngresar, 2), highlight: true },
                                      ].map((cas) => {
                                        const cKey = `${zona}-${cas.id}`;
                                        return (
                                          <div
                                            key={cKey}
                                            onClick={() => copyToClipboard(cas.val, cKey)}
                                            title="Clic para copiar en formato AEAT (sin puntos)"
                                            style={{
                                              padding: '8px 10px',
                                              borderRadius: '6px',
                                              border: cas.highlight ? '1px solid var(--lime)' : '1px solid var(--border)',
                                              background: 'var(--bg-elevated)',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <div>
                                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cas.label}</div>
                                              <div
                                                style={{
                                                  fontFamily: 'monospace',
                                                  fontWeight: 700,
                                                  fontSize: '0.92rem',
                                                  color: cas.highlight ? 'var(--lime)' : 'var(--text-primary)',
                                                }}
                                              >
                                                {cas.val}
                                              </div>
                                            </div>
                                            {copiedKey === cKey ? (
                                              <Check className="w-3.5 h-3.5 text-[var(--lime)]" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5 opacity-50" />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {cuadro.hasNegativeMinQuota && mode === 'oficial' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#f59e0b' }}>
                                        <Info className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                          Nota: La Casilla (5) de cuota mínima arroja saldo neto negativo ({formatCurrency(cuadro.casilla5CuotaMinima)}). Si la pasarela de la Sede Electrónica bloqueara el importe negativo con error 39652, cambia arriba el Modo Exportación TXT a &quot;Contingencia AEAT&quot;.
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Filas de la Zona */}
                          {rows.map((row, idx) => {
                            const isExemptRow = !row.isMinApplied && row.tipo === 0 && row.exemptMwh !== 0;
                            return (
                              <tr key={`${zona}-${idx}`}>
                                <td style={{ fontWeight: 500, color: 'var(--text-primary)', paddingLeft: '32px' }}>
                                  {row.zona}
                                  {row.isHistoricalRate && (
                                    <span
                                      className="badge badge-draft"
                                      style={{ marginLeft: '8px', color: '#f59e0b', borderColor: '#f59e0b' }}
                                    >
                                      Histórico {row.rateBucket}% (No mezclar)
                                    </span>
                                  )}
                                  {isExemptRow && (
                                    <span className="badge badge-draft" style={{ marginLeft: '8px' }}>
                                      Exento Art. 94
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {row.isMinApplied ? (
                                    <span className="badge badge-draft" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                                      Sí
                                    </span>
                                  ) : (
                                    <span className="badge badge-active">No</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                  {row.isMinApplied || isExemptRow ? '-' : `${formatNumber(row.tipo)}%`}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                  {formatCurrency(row.baseImponibleBruta)}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                  {row.isMinApplied || isExemptRow ? '-' : formatCurrency(row.baseSujeta)}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                  {row.isMinApplied || isExemptRow ? '-' : formatCurrency(row.impuestoBase)}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', borderLeft: '1px solid var(--border)' }}>
                                  {row.isMinApplied
                                    ? `${formatNumber(row.consumoMinimo, 3)} MWh`
                                    : isExemptRow
                                      ? `${formatNumber(row.exemptMwh, 3)} MWh (Ex.)`
                                      : '-'}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                  {!row.isMinApplied ? '-' : formatCurrency(row.impuestoMinimo)}
                                </td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--lime)' }}>
                                  {formatCurrency(row.total)}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Subtotal por Zona */}
                          <tr style={{ background: 'rgba(0, 0, 0, 0.14)' }}>
                            <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', paddingRight: '24px' }}>
                              Subtotal {zona}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {formatCurrency(rows.reduce((acc, r) => acc + r.baseImponibleBruta, 0))}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {formatCurrency(rows.reduce((acc, r) => acc + r.baseSujeta, 0))}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {formatCurrency(rows.reduce((acc, r) => acc + r.impuestoBase, 0))}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', borderLeft: '1px solid var(--border)' }}>
                              {formatNumber(rows.reduce((acc, r) => acc + r.consumoMinimo, 0), 3)} MWh
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {formatCurrency(rows.reduce((acc, r) => acc + r.impuestoMinimo, 0))}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--lime)', fontWeight: 'bold' }}>
                              {formatCurrency(rows.reduce((acc, r) => acc + r.total, 0))}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}

                    {/* Totales Globales */}
                    <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)', fontWeight: 'bold' }}>
                      <td colSpan={3}>TOTAL GENERAL (TODAS LAS HACIENDAS)</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {formatCurrency(results.reduce((acc, r) => acc + r.baseImponibleBruta, 0))}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {formatCurrency(results.reduce((acc, r) => acc + r.baseSujeta, 0))}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {formatCurrency(results.reduce((acc, r) => acc + r.impuestoBase, 0))}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', borderLeft: '1px solid var(--border)' }}>
                        {formatNumber(results.reduce((acc, r) => acc + r.consumoMinimo, 0), 3)} MWh
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
