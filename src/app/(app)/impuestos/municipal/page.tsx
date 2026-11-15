'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, FileText, Download, Loader2, ArrowLeft, ExternalLink, X, ChevronRight } from 'lucide-react';
import Topbar from '@/components/Topbar';
import * as XLSX from 'xlsx';

interface Poblacion {
  label: string;
  value: string; // "Municipio -- Provincia"
  ineCode?: string;
}

interface GroupedResult {
  groupKey: string;
  ineCode: string | null;
  cp: string;
  cpList: string;
  poblacion: string;
  provincia: string;
  queryValue: string;
  invoiceCount: number;
  energiaConsumida: number;
  base: number;
  tasa: number;
}

interface DetailedResult {
  id: string;
  pdfUrl: string | null;
  issueDate: string;
  billingStart: string;
  billingEnd: string;
  cups: string;
  distribuidora: string;
  nifCliente: string;
  invoiceNumber: string;
  codigoFiscal: string;
  invoiceType: string;
  tariff: string;
  postalCode: string;
  poblacion?: string;
  energiaConsumida: number; // MWh
  importeIVA: number;
  baseImponibleFactura: number;
  baseImponibleF1: number;
  importeImpuesto: number;
  importeBonoSocial: number;
  importeSVA: number;
  baseImponibleTasaMunicipal: number;
  tasaMunicipal: number;
}

interface CachedGroupedSnapshot {
  results: GroupedResult[];
  totalBase: number;
  totalTasa: number;
  totalInvoices: number;
  totalEnergia: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

function normalizeClientSearch(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function TasaMunicipalPage() {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const yrs: number[] = [];
    for (let y = currentYear + 1; y >= 2022; y--) yrs.push(y);
    return yrs;
  }, [currentYear]);

  const [quickYear, setQuickYear] = useState<number>(currentYear);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState<'all' | 'specific'>('all');
  const [scope, setScope] = useState<'brand' | 'company'>('brand');
  const [postalCode, setPostalCode] = useState('');

  const [poblaciones, setPoblaciones] = useState<Poblacion[]>([]);
  const [loadingPoblaciones, setLoadingPoblaciones] = useState(false);
  const [searchPoblacion, setSearchPoblacion] = useState('');

  const [loading, setLoading] = useState(false);
  const [resultsType, setResultsType] = useState<'grouped' | 'detailed' | null>(null);
  const [groupedResults, setGroupedResults] = useState<GroupedResult[]>([]);
  const [detailedResults, setDetailedResults] = useState<DetailedResult[]>([]);
  const [activeDetailTitle, setActiveDetailTitle] = useState('');
  const [cachedGrouped, setCachedGrouped] = useState<CachedGroupedSnapshot | null>(null);
  const [tableFilter, setTableFilter] = useState('');

  const [totalBase, setTotalBase] = useState(0);
  const [totalTasa, setTotalTasa] = useState(0);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalEnergia, setTotalEnergia] = useState(0);
  const [error, setError] = useState('');

  const applyPeriodPreset = (preset: '1T' | '2T' | '3T' | '4T' | 'YEAR', yr = quickYear) => {
    if (preset === '1T') {
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-03-31`);
    } else if (preset === '2T') {
      setStartDate(`${yr}-04-01`);
      setEndDate(`${yr}-06-30`);
    } else if (preset === '3T') {
      setStartDate(`${yr}-07-01`);
      setEndDate(`${yr}-09-30`);
    } else if (preset === '4T') {
      setStartDate(`${yr}-10-01`);
      setEndDate(`${yr}-12-31`);
    } else {
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-12-31`);
    }
  };

  const activePreset = useMemo(() => {
    if (startDate === `${quickYear}-01-01` && endDate === `${quickYear}-03-31`) return '1T';
    if (startDate === `${quickYear}-04-01` && endDate === `${quickYear}-06-30`) return '2T';
    if (startDate === `${quickYear}-07-01` && endDate === `${quickYear}-09-30`) return '3T';
    if (startDate === `${quickYear}-10-01` && endDate === `${quickYear}-12-31`) return '4T';
    if (startDate === `${quickYear}-01-01` && endDate === `${quickYear}-12-31`) return 'YEAR';
    return null;
  }, [startDate, endDate, quickYear]);

  // Búsqueda con debounce de poblaciones (soporta sin tildes, apóstrofes, provincia, pedanía o CP)
  useEffect(() => {
    if (mode === 'specific' && searchPoblacion.trim().length >= 2 && !postalCode) {
      const delayFn = setTimeout(async () => {
        setLoadingPoblaciones(true);
        try {
          const res = await fetch(`/api/impuestos/municipal/poblaciones?q=${encodeURIComponent(searchPoblacion.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setPoblaciones(data);
          }
        } catch (e) {
          console.error(e);
        }
        setLoadingPoblaciones(false);
      }, 300);
      return () => clearTimeout(delayFn);
    } else if (!searchPoblacion.trim()) {
      setPoblaciones([]);
    }
  }, [searchPoblacion, mode, postalCode]);

  const handleConsultar = async () => {
    if (!startDate || !endDate) {
      setError('Por favor, selecciona fecha desde y hasta (o pulsa un trimestre rápido).');
      return;
    }
    if (mode === 'specific' && !postalCode) {
      setError('Por favor, selecciona un ayuntamiento de la lista desplegable.');
      return;
    }

    setError('');
    setLoading(true);
    setResultsType(null);
    setCachedGrouped(null);
    setTableFilter('');

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        scope,
      });
      if (mode === 'specific') {
        params.append('postalCode', postalCode);
      }

      const res = await fetch(`/api/impuestos/municipal?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Error al calcular la tasa municipal');
      }

      const data = await res.json();
      setResultsType(data.type);
      setTotalBase(data.totalBaseGlobal || 0);
      setTotalTasa(data.totalTasaGlobal || 0);
      setTotalInvoices(data.totalInvoicesGlobal || 0);
      setTotalEnergia(data.totalEnergiaGlobal || 0);

      if (data.type === 'grouped') {
        setGroupedResults(data.results || []);
        setActiveDetailTitle('');
      } else {
        setDetailedResults(data.results || []);
        setActiveDetailTitle(data.municipalityLabel || postalCode.split(' -- ')[0] || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Drill-down directo al pulsar sobre una fila de "Todos los ayuntamientos"
  const handleDrillDownRow = async (row: GroupedResult) => {
    setCachedGrouped({
      results: groupedResults,
      totalBase,
      totalTasa,
      totalInvoices,
      totalEnergia,
    });
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        scope,
        groupKey: row.groupKey,
      });
      if (row.queryValue) {
        params.append('postalCode', row.queryValue);
      }

      const res = await fetch(`/api/impuestos/municipal?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Error al cargar el desglose del ayuntamiento');
      }

      const data = await res.json();
      setResultsType('detailed');
      setDetailedResults(data.results || []);
      setActiveDetailTitle(
        row.provincia ? `${row.poblacion} (${row.provincia})` : row.poblacion
      );
      setTotalBase(data.totalBaseGlobal || 0);
      setTotalTasa(data.totalTasaGlobal || 0);
      setTotalInvoices(data.totalInvoicesGlobal || 0);
      setTotalEnergia(data.totalEnergiaGlobal || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToGrouped = () => {
    if (!cachedGrouped) return;
    setResultsType('grouped');
    setGroupedResults(cachedGrouped.results);
    setTotalBase(cachedGrouped.totalBase);
    setTotalTasa(cachedGrouped.totalTasa);
    setTotalInvoices(cachedGrouped.totalInvoices);
    setTotalEnergia(cachedGrouped.totalEnergia);
    setDetailedResults([]);
    setActiveDetailTitle('');
    setCachedGrouped(null);
  };

  const filteredGroupedResults = useMemo(() => {
    const q = normalizeClientSearch(tableFilter);
    if (!q) return groupedResults;
    return groupedResults.filter(
      (r) =>
        normalizeClientSearch(r.poblacion).includes(q) ||
        normalizeClientSearch(r.provincia).includes(q) ||
        normalizeClientSearch(r.cpList).includes(q) ||
        (r.ineCode && r.ineCode.includes(q))
    );
  }, [groupedResults, tableFilter]);

  const filteredGroupedTotals = useMemo(() => {
    if (!tableFilter.trim()) {
      return {
        invoices: totalInvoices,
        energia: totalEnergia,
        base: totalBase,
        tasa: totalTasa,
      };
    }
    return {
      invoices: filteredGroupedResults.reduce((acc, r) => acc + r.invoiceCount, 0),
      energia: round3(filteredGroupedResults.reduce((acc, r) => acc + r.energiaConsumida, 0)),
      base: round2(filteredGroupedResults.reduce((acc, r) => acc + r.base, 0)),
      tasa: round2(filteredGroupedResults.reduce((acc, r) => acc + r.tasa, 0)),
    };
  }, [filteredGroupedResults, tableFilter, totalInvoices, totalEnergia, totalBase, totalTasa]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatMwh = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
  };

  // Exportación Excel con fila TOTAL al final y cuadre horizontal completo
  const handleDownloadExcel = () => {
    if (!resultsType) return;

    let ws: XLSX.WorkSheet;
    let filename = '';

    if (resultsType === 'grouped') {
      const sourceRows = filteredGroupedResults;
      const rows = sourceRows.map((r) => ({
        'Código INE': r.ineCode || 'REVISAR',
        'CP Principal': r.cp,
        'Códigos Postales': r.cpList,
        Ayuntamiento: r.poblacion,
        Provincia: r.provincia || '',
        'Nº Facturas': r.invoiceCount,
        'Energía Consumida (MWh)': round3(r.energiaConsumida),
        'Base Imponible (€)': round2(r.base),
        'Tasa Municipal 1,5% (€)': round2(r.tasa),
      }));

      rows.push({
        'Código INE': 'TOTAL',
        'CP Principal': '',
        'Códigos Postales': '',
        Ayuntamiento: `${sourceRows.length} ayuntamientos`,
        Provincia: '',
        'Nº Facturas': filteredGroupedTotals.invoices,
        'Energía Consumida (MWh)': round3(filteredGroupedTotals.energia),
        'Base Imponible (€)': round2(filteredGroupedTotals.base),
        'Tasa Municipal 1,5% (€)': round2(filteredGroupedTotals.tasa),
      });

      ws = XLSX.utils.json_to_sheet(rows);
      filename = `Tasa_Municipal_Global_${startDate}_${endDate}.xlsx`;
    } else {
      const sumEnergia = round3(detailedResults.reduce((acc, r) => acc + r.energiaConsumida, 0));
      const sumBaseIva = round2(detailedResults.reduce((acc, r) => acc + r.importeIVA, 0));
      const sumBaseF1 = round2(detailedResults.reduce((acc, r) => acc + r.baseImponibleF1, 0));
      const sumImpuesto = round2(detailedResults.reduce((acc, r) => acc + r.importeImpuesto, 0));
      const sumBono = round2(detailedResults.reduce((acc, r) => acc + r.importeBonoSocial, 0));
      const sumSva = round2(detailedResults.reduce((acc, r) => acc + (r.importeSVA || 0), 0));

      const rows = detailedResults.map((r) => ({
        'Fecha Factura': formatDate(r.issueDate),
        'NIF Cliente': r.nifCliente,
        Desde: formatDate(r.billingStart),
        Hasta: formatDate(r.billingEnd),
        CUPS: r.cups,
        'Número Factura': r.invoiceNumber,
        'Código Fiscal': r.codigoFiscal,
        'Tipo Factura': r.invoiceType,
        'Tarifa ATR': r.tariff,
        'CP PS': r.postalCode,
        'Energía Consumida (MWh)': round3(r.energiaConsumida),
        Distribuidora: r.distribuidora,
        'Base Imponible IVA': round2(r.importeIVA),
        'Base Imponible F1': round2(r.baseImponibleF1),
        'Importe Impuesto': round2(r.importeImpuesto),
        'Importe Bono Social': round2(r.importeBonoSocial),
        'SVA / Otros Excluidos': round2(r.importeSVA || 0),
        'Base Imponible Tasa Municipal': round2(r.baseImponibleTasaMunicipal),
        'Tasa Municipal (1,5%)': round2(r.tasaMunicipal),
      }));

      rows.push({
        'Fecha Factura': 'TOTAL',
        'NIF Cliente': '',
        Desde: '',
        Hasta: '',
        CUPS: '',
        'Número Factura': `${detailedResults.length} facturas`,
        'Código Fiscal': '',
        'Tipo Factura': '',
        'Tarifa ATR': '',
        'CP PS': '',
        'Energía Consumida (MWh)': sumEnergia,
        Distribuidora: '',
        'Base Imponible IVA': sumBaseIva,
        'Base Imponible F1': sumBaseF1,
        'Importe Impuesto': sumImpuesto,
        'Importe Bono Social': sumBono,
        'SVA / Otros Excluidos': sumSva,
        'Base Imponible Tasa Municipal': round2(totalBase),
        'Tasa Municipal (1,5%)': round2(totalTasa),
      });

      ws = XLSX.utils.json_to_sheet(rows);
      const rawName = activeDetailTitle || postalCode || searchPoblacion || 'Municipio';
      const safePob = rawName
        .split(' -- ')[0]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      filename = `Tasa_Municipal_Detalle_${safePob}_${startDate}_${endDate}.xlsx`;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasa Municipal');
    XLSX.writeFile(wb, filename);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Tasa Municipal"
        subtitle="Gestión del 1,5% de Tasa Municipal por utilización privativa o aprovechamiento especial (Art. 24.1.c TRLRHL)"
      />

      <div
        style={{
          padding: '24px 32px',
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          paddingBottom: '120px',
        }}
      >
        <div className="card animate-fade-in-up" style={{ padding: '24px 32px' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              Filtros de Cálculo
            </h2>

            {/* Atajos rápidos de Trimestre / Ejercicio */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>
                Periodo rápido:
              </span>
              <select
                value={quickYear}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  setQuickYear(yr);
                  if (activePreset) applyPeriodPreset(activePreset, yr);
                }}
                className="form-input"
                style={{ height: '32px', padding: '0 28px 0 10px', fontSize: '0.8rem', width: 'auto' }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {(['1T', '2T', '3T', '4T', 'YEAR'] as const).map((p) => {
                const isActive = activePreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPeriodPreset(p)}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: isActive ? '1px solid var(--lime)' : '1px solid var(--border)',
                      background: isActive ? 'rgba(222, 255, 154, 0.14)' : 'var(--bg-elevated)',
                      color: isActive ? 'var(--lime)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {p === 'YEAR' ? 'Año completo' : p}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 170px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Fecha Factura Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 170px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Fecha Factura Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Sociedad / Marca
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'brand' | 'company')}
                className="form-input"
              >
                <option value="brand">Marca activa seleccionada</option>
                <option value="company">Toda la Comercializadora</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 210px' }}>
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Ámbito Municipal
              </label>
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as 'all' | 'specific');
                  setPostalCode('');
                  setSearchPoblacion('');
                  setPoblaciones([]);
                  setCachedGrouped(null);
                }}
                className="form-input"
              >
                <option value="all">Todos los ayuntamientos</option>
                <option value="specific">Ayuntamiento específico</option>
              </select>
            </div>

            {mode === 'specific' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 310px', position: 'relative' }}>
                <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                  Ayuntamiento / CP / Pedanía
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej: Cordoba, Baena, Albendin, 14859..."
                    value={searchPoblacion}
                    onChange={(e) => {
                      setSearchPoblacion(e.target.value);
                      if (postalCode) setPostalCode('');
                    }}
                    className="form-input"
                    style={{ paddingRight: '34px' }}
                  />
                  {loadingPoblaciones ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                  ) : searchPoblacion ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPoblacion('');
                        setPostalCode('');
                        setPoblaciones([]);
                      }}
                      title="Limpiar selección"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-80"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}

                  {searchPoblacion.trim().length >= 2 && !postalCode && poblaciones.length > 0 && (
                    <div
                      className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg shadow-xl"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    >
                      {poblaciones.map((pob, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchPoblacion(pob.label);
                            setPostalCode(pob.value);
                            setPoblaciones([]);
                          }}
                          className="px-3 py-2 text-sm cursor-pointer hover:opacity-80"
                          style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}
                        >
                          {pob.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {searchPoblacion.trim().length >= 2 && !postalCode && !loadingPoblaciones && poblaciones.length === 0 && (
                    <div
                      className="absolute z-50 mt-1 w-full rounded-lg p-3 text-sm text-center"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                      No se encontraron poblaciones coincidentes
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                marginLeft: 'auto',
                alignSelf: 'flex-end',
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '12px',
                gap: '12px',
              }}
            >
              {resultsType && (
                <button
                  onClick={handleDownloadExcel}
                  className="btn-secondary"
                  style={{
                    padding: '8px 24px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                  }}
                >
                  <Download className="h-5 w-5" />
                  Descargar Excel
                </button>
              )}
              <button
                onClick={handleConsultar}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 24px', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                Consultar
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--lime)' }} />
          </div>
        )}

        {/* RESULTADOS AGRUPADOS */}
        {!loading && resultsType === 'grouped' && (
          <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
            >
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Liquidación Agrupada por Ayuntamiento Oficial INE ({filteredGroupedResults.length} de {groupedResults.length} ayuntamientos)
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Haz clic en cualquier fila para inspeccionar y exportar las facturas individuales de ese ayuntamiento.
                </p>
              </div>
              <div style={{ minWidth: '280px', flex: '0 1 340px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Filtrar por ayuntamiento, CP o provincia..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="form-input"
                  style={{ height: '36px', fontSize: '0.85rem', paddingRight: tableFilter ? '30px' : '12px' }}
                />
                {tableFilter && (
                  <button
                    type="button"
                    onClick={() => setTableFilter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CP</th>
                    <th>Ayuntamiento</th>
                    <th>Provincia</th>
                    <th style={{ textAlign: 'right' }}>Facturas</th>
                    <th style={{ textAlign: 'right' }}>Energía (MWh)</th>
                    <th style={{ textAlign: 'right' }}>Base Imponible (€)</th>
                    <th style={{ textAlign: 'right', color: 'var(--lime)' }}>Tasa Municipal (€)</th>
                    <th style={{ width: '44px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupedResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No se encontraron ayuntamientos para los criterios seleccionados
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredGroupedResults.map((row) => (
                        <tr
                          key={row.groupKey}
                          onClick={() => handleDrillDownRow(row)}
                          title="Haz clic para ver el detalle de facturas de este ayuntamiento"
                          style={{ cursor: 'pointer' }}
                        >
                          <td
                            title={row.cpList}
                            style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}
                          >
                            {row.cp}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span style={{ fontWeight: 500 }}>{row.poblacion}</span>
                              {!row.ineCode && (
                                <span
                                  className="px-1.5 py-0.5 text-[10px] rounded font-semibold uppercase"
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                  }}
                                >
                                  Revisar ficha CUPS
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{row.provincia || '-'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {row.invoiceCount}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatMwh(row.energiaConsumida)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.base)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--lime)' }}>
                            {formatCurrency(row.tasa)}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            <ChevronRight className="h-4 w-4 inline" />
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)', fontWeight: 'bold' }}>
                        <td colSpan={3}>
                          TOTAL ({filteredGroupedResults.length} ayuntamientos)
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {filteredGroupedTotals.invoices}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatMwh(filteredGroupedTotals.energia)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCurrency(filteredGroupedTotals.base)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--lime)' }}>
                          {formatCurrency(filteredGroupedTotals.tasa)}
                        </td>
                        <td></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTADOS DETALLADOS */}
        {!loading && resultsType === 'detailed' && (
          <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center gap-3">
                {cachedGrouped && (
                  <button
                    type="button"
                    onClick={handleBackToGrouped}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-85"
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver a todos los ayuntamientos
                  </button>
                )}
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Desglose de Facturas — {activeDetailTitle || 'Ayuntamiento seleccionado'}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {detailedResults.length} facturas · Fórmula: Base IVA − Base F1 − Impuesto Eléctrico − Bono Social − SVA/Otros = Base Tasa Municipal
                  </p>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>PDF</th>
                    <th>NIF Cliente</th>
                    <th>Fecha Factura</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>CUPS</th>
                    <th>Número Factura</th>
                    <th>Código Fiscal</th>
                    <th>Tipo Factura</th>
                    <th>Tarifa ATR</th>
                    <th>CP PS</th>
                    <th style={{ textAlign: 'right' }}>
                      Energía Consumida
                      <br />
                      (MWh)
                    </th>
                    <th>Distribuidora</th>
                    <th style={{ textAlign: 'right' }}>
                      Base Imponible
                      <br />
                      IVA
                    </th>
                    <th style={{ textAlign: 'right' }}>Base Imponible F1</th>
                    <th style={{ textAlign: 'right' }}>Importe Impuesto</th>
                    <th style={{ textAlign: 'right' }}>Importe Bono Social</th>
                    <th style={{ textAlign: 'right' }}>
                      SVA / Otros
                      <br />
                      Excluidos
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      Base Imponible
                      <br />
                      Tasa Municipal
                    </th>
                    <th style={{ textAlign: 'right', color: 'var(--lime)' }}>Tasa Municipal</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.8rem' }}>
                  {detailedResults.length === 0 ? (
                    <tr>
                      <td colSpan={20} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No se encontraron facturas para este ayuntamiento en las fechas seleccionadas
                      </td>
                    </tr>
                  ) : (
                    <>
                      {detailedResults.map((row) => (
                        <tr key={row.id}>
                          <td style={{ textAlign: 'center' }}>
                            {row.pdfUrl ? (
                              <a
                                href={row.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir PDF en la nube"
                                style={{
                                  display: 'inline-flex',
                                  padding: '4px',
                                  background: 'var(--danger-alpha)',
                                  color: 'var(--danger)',
                                  borderRadius: '4px',
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{row.nifCliente}</td>
                          <td style={{ fontFamily: 'monospace' }}>{formatDate(row.issueDate)}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatDate(row.billingStart)}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatDate(row.billingEnd)}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{row.cups}</td>
                          <td>
                            <Link
                              href={`/facturas/${row.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 hover:underline"
                              style={{ color: 'var(--lime)', fontWeight: 500 }}
                              title="Abrir ficha detallada de la factura"
                            >
                              {row.invoiceNumber}
                              <ExternalLink className="h-3 w-3 opacity-75" />
                            </Link>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{row.codigoFiscal}</td>
                          <td>{row.invoiceType}</td>
                          <td>{row.tariff}</td>
                          <td style={{ fontFamily: 'monospace' }}>{row.postalCode}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatMwh(row.energiaConsumida)}</td>
                          <td>{row.distribuidora || '-'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.importeIVA)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {formatCurrency(row.baseImponibleF1)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {formatCurrency(row.importeImpuesto)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {formatCurrency(row.importeBonoSocial)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {formatCurrency(row.importeSVA || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                            {formatCurrency(row.baseImponibleTasaMunicipal)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--lime)' }}>
                            {formatCurrency(row.tasaMunicipal)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border)', fontWeight: 'bold' }}>
                        <td colSpan={11}>TOTAL ({detailedResults.length} facturas)</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatMwh(detailedResults.reduce((acc, r) => acc + r.energiaConsumida, 0))}
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCurrency(detailedResults.reduce((acc, r) => acc + r.importeIVA, 0))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {formatCurrency(detailedResults.reduce((acc, r) => acc + r.baseImponibleF1, 0))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {formatCurrency(detailedResults.reduce((acc, r) => acc + r.importeImpuesto, 0))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {formatCurrency(detailedResults.reduce((acc, r) => acc + r.importeBonoSocial, 0))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {formatCurrency(detailedResults.reduce((acc, r) => acc + (r.importeSVA || 0), 0))}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(totalBase)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--lime)' }}>{formatCurrency(totalTasa)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TOTALES (Fijo al fondo si hay resultados) */}
        {!loading && resultsType && (
          <div className="fixed bottom-0 left-0 right-0 md:left-[260px] bg-[var(--bg-elevated)] border-t border-[var(--border)] p-4 shadow-2xl z-40">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-center items-center gap-4">
              <div className="flex flex-wrap rounded-lg overflow-hidden border border-[var(--border)]">
                <div
                  className="px-5 py-3 text-center flex flex-col justify-center"
                  style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', borderRight: '1px solid var(--border)' }}
                >
                  <span className="text-[11px] uppercase tracking-wider font-semibold opacity-75">Facturas / Energía</span>
                  <span className="text-base font-bold font-mono">
                    {totalInvoices} fact. · {formatMwh(totalEnergia)} MWh
                  </span>
                </div>
                <div
                  className="px-6 py-3 text-center flex flex-col justify-center"
                  style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                >
                  <span className="text-xs uppercase tracking-wider font-semibold opacity-80">Total Base Imponible</span>
                  <span className="text-xl font-bold font-mono">{formatCurrency(totalBase)} €</span>
                </div>
                <div className="bg-[var(--lime)] text-black px-6 py-3 text-center flex flex-col justify-center">
                  <span className="text-xs uppercase tracking-wider font-semibold opacity-90">Total Tasa Municipal (1,5%)</span>
                  <span className="text-xl font-bold font-mono">{formatCurrency(totalTasa)} €</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
