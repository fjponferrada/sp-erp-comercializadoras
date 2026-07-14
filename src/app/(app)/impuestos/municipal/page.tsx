'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Search, FileText, Download, Loader2 } from 'lucide-react';
import Topbar from '@/components/Topbar';
import * as XLSX from 'xlsx';

interface Poblacion {
  label: string;
  value: string; // postalCode
}

interface GroupedResult {
  cp: string;
  poblacion: string;
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
  energiaConsumida: number;
  importeIVA: number;
  baseImponibleFactura: number;
  baseImponibleF1: number;
  importeImpuesto: number;
  importeBonoSocial: number;
  baseImponibleTasaMunicipal: number;
  tasaMunicipal: number;
}

export default function TasaMunicipalPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState<'all' | 'specific'>('all');
  const [postalCode, setPostalCode] = useState('');
  
  const [poblaciones, setPoblaciones] = useState<Poblacion[]>([]);
  const [loadingPoblaciones, setLoadingPoblaciones] = useState(false);
  const [searchPoblacion, setSearchPoblacion] = useState('');

  const [loading, setLoading] = useState(false);
  const [resultsType, setResultsType] = useState<'grouped' | 'detailed' | null>(null);
  const [groupedResults, setGroupedResults] = useState<GroupedResult[]>([]);
  const [detailedResults, setDetailedResults] = useState<DetailedResult[]>([]);
  const [totalBase, setTotalBase] = useState(0);
  const [totalTasa, setTotalTasa] = useState(0);
  const [error, setError] = useState('');

  // Debounced fetch for poblaciones
  useEffect(() => {
    if (mode === 'specific' && searchPoblacion.length >= 2) {
      const delayFn = setTimeout(async () => {
        setLoadingPoblaciones(true);
        try {
          const res = await fetch(`/api/impuestos/municipal/poblaciones?q=${encodeURIComponent(searchPoblacion)}`);
          if (res.ok) {
            const data = await res.json();
            setPoblaciones(data);
          }
        } catch (e) {
          console.error(e);
        }
        setLoadingPoblaciones(false);
      }, 500);
      return () => clearTimeout(delayFn);
    }
  }, [searchPoblacion, mode]);

  const handleConsultar = async () => {
    if (!startDate || !endDate) {
      setError('Por favor, selecciona fecha desde y hasta.');
      return;
    }
    if (mode === 'specific' && !postalCode) {
      setError('Por favor, selecciona una población.');
      return;
    }

    setError('');
    setLoading(true);
    setResultsType(null);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      });
      if (mode === 'specific') {
        params.append('postalCode', postalCode);
      }

      const res = await fetch(`/api/impuestos/municipal?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Error al calcular la tasa municipal');
      }

      const data = await res.json();
      setResultsType(data.type);
      setTotalBase(data.totalBaseGlobal);
      setTotalTasa(data.totalTasaGlobal);

      if (data.type === 'grouped') {
        setGroupedResults(data.results);
      } else {
        setDetailedResults(data.results);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES');
  };

  const handleDownloadExcel = () => {
    if (!resultsType) return;
    
    let ws: XLSX.WorkSheet;
    let filename = '';

    if (resultsType === 'grouped') {
      const data = groupedResults.map(r => ({
        'CP': r.cp,
        'Población': r.poblacion,
        'Base Imponible (€)': r.base,
        'Tasa Municipal (€)': r.tasa
      }));
      ws = XLSX.utils.json_to_sheet(data);
      filename = `Tasa_Municipal_Global_${startDate}_${endDate}.xlsx`;
    } else {
      const data = detailedResults.map(r => ({
        'Fecha Factura': formatDate(r.issueDate),
        'NIF Cliente': r.nifCliente,
        'Desde': formatDate(r.billingStart),
        'Hasta': formatDate(r.billingEnd),
        'CUPS': r.cups,
        'Número Factura': r.invoiceNumber,
        'Código Fiscal': r.codigoFiscal,
        'Tipo Factura': r.invoiceType,
        'Tarifa ATR': r.tariff,
        'CP PS': r.postalCode,
        'Energía Total Consumida': r.energiaConsumida,
        'Distribuidora': r.distribuidora,
        'Base Imponible IVA': r.importeIVA,
        'Base Imponible F1': r.baseImponibleF1,
        'Importe Impuesto': r.importeImpuesto,
        'Importe Bono Social': r.importeBonoSocial,
        'Base Imponible Tasa Municipal': r.baseImponibleTasaMunicipal,
        'Tasa Municipal': r.tasaMunicipal
      }));
      ws = XLSX.utils.json_to_sheet(data);
      filename = `Tasa_Municipal_Detalle_${searchPoblacion || postalCode}_${startDate}_${endDate}.xlsx`;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasa Municipal');
    XLSX.writeFile(wb, filename);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Tasa Municipal" subtitle="Gestión del 1.5% de Tasa Municipal por utilización privativa" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '120px' }}>

        <div className="card animate-fade-in-up" style={{ padding: '24px 32px' }}>
          <h2 className="text-lg font-medium text-white mb-6">Filtros de Cálculo</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fecha Factura Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fecha Factura Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 250px' }}>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Ámbito</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'all' | 'specific');
                setPostalCode('');
              }}
              className="form-input"
            >
              <option value="all">Todos los ayuntamientos</option>
              <option value="specific">Ayuntamiento específico</option>
            </select>
          </div>

          {mode === 'specific' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 250px', position: 'relative' }}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Población</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar población..."
                  value={searchPoblacion}
                  onChange={(e) => {
                    setSearchPoblacion(e.target.value);
                    if (postalCode) setPostalCode('');
                  }}
                  className="form-input"
                />
                {loadingPoblaciones && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
                
                {searchPoblacion.length >= 2 && !postalCode && poblaciones.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                    {poblaciones.map((pob, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setSearchPoblacion(pob.label);
                          setPostalCode(pob.value);
                          setPoblaciones([]);
                        }}
                        className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        {pob.label}
                      </div>
                    ))}
                  </div>
                )}
                
                {searchPoblacion.length >= 2 && !postalCode && !loadingPoblaciones && poblaciones.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-400 text-center">
                    No se encontraron poblaciones
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '12px' }}>
            {resultsType && (
              <button
                onClick={handleDownloadExcel}
                className="btn-secondary"
                style={{ padding: '8px 24px', height: '42px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'white', borderRadius: '8px' }}
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
          <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
        </div>
      )}

      {/* RESULTADOS AGRUPADOS */}
      {!loading && resultsType === 'grouped' && (
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CP</th>
                  <th>Población</th>
                  <th style={{ textAlign: 'right' }}>Base Imponible (€)</th>
                  <th style={{ textAlign: 'right', color: 'var(--lime)' }}>Tasa Municipal (€)</th>
                </tr>
              </thead>
              <tbody>
                {groupedResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron datos para las fechas seleccionadas
                    </td>
                  </tr>
                ) : (
                  groupedResults.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, color: '#fff' }}>{row.cp}</td>
                      <td>{row.poblacion}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.base)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--lime)' }}>{formatCurrency(row.tasa)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESULTADOS DETALLADOS */}
      {!loading && resultsType === 'detailed' && (
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
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
                  <th style={{ textAlign: 'right' }}>Energía Total<br/>Consumida</th>
                  <th>Distribuidora</th>
                  <th style={{ textAlign: 'right' }}>Base Imponible<br/>IVA</th>
                  <th style={{ textAlign: 'right' }}>Base Imponible F1</th>
                  <th style={{ textAlign: 'right' }}>Importe Impuesto</th>
                  <th style={{ textAlign: 'right' }}>Importe Bono Social</th>
                  <th style={{ textAlign: 'right' }}>Base Imponible<br/>Tasa Municipal</th>
                  <th style={{ textAlign: 'right', color: 'var(--lime)' }}>Tasa Municipal</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '0.8rem' }}>
                {detailedResults.length === 0 ? (
                  <tr>
                    <td colSpan={19} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron facturas para este municipio en las fechas seleccionadas
                    </td>
                  </tr>
                ) : (
                  detailedResults.map((row) => (
                    <tr key={row.id}>
                      <td style={{ textAlign: 'center' }}>
                        {row.pdfUrl ? (
                          <a href={row.pdfUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', padding: '4px', background: 'var(--danger-alpha)', color: 'var(--danger)', borderRadius: '4px' }}>
                            <FileText className="h-4 w-4" />
                          </a>
                        ) : '-'}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{row.nifCliente}</td>
                      <td style={{ fontFamily: 'monospace' }}>{formatDate(row.issueDate)}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatDate(row.billingStart)}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatDate(row.billingEnd)}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{row.cups}</td>
                      <td style={{ color: 'var(--lime)', fontWeight: 500 }}>{row.invoiceNumber}</td>
                      <td style={{ fontFamily: 'monospace' }}>{row.codigoFiscal}</td>
                      <td>{row.invoiceType}</td>
                      <td>{row.tariff}</td>
                      <td style={{ fontFamily: 'monospace' }}>{row.postalCode}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.energiaConsumida)}</td>
                      <td>{row.distribuidora}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.importeIVA)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(row.baseImponibleF1)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(row.importeImpuesto)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(row.importeBonoSocial)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{formatCurrency(row.baseImponibleTasaMunicipal)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--lime)' }}>{formatCurrency(row.tasaMunicipal)}</td>
                    </tr>
                  ))
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
            <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
              <div className="bg-slate-800 text-white px-6 py-3 text-center flex flex-col justify-center">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90">Total Base Imponible</span>
                <span className="text-xl font-bold">{formatCurrency(totalBase)} €</span>
              </div>
              <div className="bg-[var(--lime)] text-black px-6 py-3 text-center flex flex-col justify-center">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90">Total Tasa Municipal</span>
                <span className="text-xl font-bold">{formatCurrency(totalTasa)} €</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </div>

    </div>
  );
}
