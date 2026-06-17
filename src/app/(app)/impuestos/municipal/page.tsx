'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Search, FileText, Download, Loader2 } from 'lucide-react';

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

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="text-rose-500" />
            Cálculo de Tasa Municipal
          </h1>
          <p className="text-slate-400 mt-1">Gestión del 1.5% de Tasa Municipal por utilización privativa</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-4">Filtros de Cálculo</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-400">Fecha Factura Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-400">Fecha Factura Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-400">Ámbito</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'all' | 'specific');
                setPostalCode('');
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Todos los ayuntamientos</option>
              <option value="specific">Ayuntamiento específico</option>
            </select>
          </div>

          {mode === 'specific' && (
            <div className="space-y-1.5 relative">
              <label className="block text-xs font-medium text-slate-400">Población</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar población..."
                  value={searchPoblacion}
                  onChange={(e) => {
                    setSearchPoblacion(e.target.value);
                    // Also clear selected if user types to search again
                    if (postalCode) setPostalCode('');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {loadingPoblaciones && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                
                {/* Custom dropdown for results */}
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

          <div className="flex pt-1 md:col-span-full justify-end">
            <button
              onClick={handleConsultar}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-600/20 text-blue-400 text-xs uppercase tracking-wider border-b border-slate-700/50">
                  <th className="px-4 py-3 font-semibold">CP</th>
                  <th className="px-4 py-3 font-semibold">Población</th>
                  <th className="px-4 py-3 font-semibold text-right">Base Imponible (€)</th>
                  <th className="px-4 py-3 font-semibold text-right">Tasa Municipal (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {groupedResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No se encontraron datos para las fechas seleccionadas
                    </td>
                  </tr>
                ) : (
                  groupedResults.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 text-slate-300">{row.cp}</td>
                      <td className="px-4 py-3 text-slate-300">{row.poblacion}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-200">{formatCurrency(row.base)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-200">{formatCurrency(row.tasa)}</td>
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
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-blue-600/20 text-blue-400 text-[11px] uppercase tracking-wider border-b border-slate-700/50">
                  <th className="px-3 py-3 font-semibold text-center">PDF</th>
                  <th className="px-3 py-3 font-semibold">Fecha Factura</th>
                  <th className="px-3 py-3 font-semibold">Desde</th>
                  <th className="px-3 py-3 font-semibold">Hasta</th>
                  <th className="px-3 py-3 font-semibold">CUPS</th>
                  <th className="px-3 py-3 font-semibold">Número Factura</th>
                  <th className="px-3 py-3 font-semibold">Código Fiscal</th>
                  <th className="px-3 py-3 font-semibold">Tipo Factura</th>
                  <th className="px-3 py-3 font-semibold">Tarifa ATR</th>
                  <th className="px-3 py-3 font-semibold">CP PS</th>
                  <th className="px-3 py-3 font-semibold text-right">Energía Total<br/>Consumida</th>
                  <th className="px-3 py-3 font-semibold text-right">Importe IVA</th>
                  <th className="px-3 py-3 font-semibold text-right">Base Imponible<br/>Factura</th>
                  <th className="px-3 py-3 font-semibold text-right">Base Imponible F1</th>
                  <th className="px-3 py-3 font-semibold text-right">Importe Impuesto</th>
                  <th className="px-3 py-3 font-semibold text-right">Importe Bono Social</th>
                  <th className="px-3 py-3 font-semibold text-right">Base Imponible<br/>Tasa Municipal</th>
                  <th className="px-3 py-3 font-semibold text-right text-rose-400">Tasa Municipal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-xs">
                {detailedResults.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center text-slate-400">
                      No se encontraron facturas para este municipio en las fechas seleccionadas
                    </td>
                  </tr>
                ) : (
                  detailedResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-3 py-2 text-center">
                        {row.pdfUrl ? (
                          <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex bg-red-500/20 text-red-500 p-1.5 rounded hover:bg-red-500/30 transition-colors">
                            <FileText className="h-3 w-3" />
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{formatDate(row.issueDate)}</td>
                      <td className="px-3 py-2 text-slate-400">{formatDate(row.billingStart)}</td>
                      <td className="px-3 py-2 text-slate-400">{formatDate(row.billingEnd)}</td>
                      <td className="px-3 py-2 text-slate-300">{row.cups}</td>
                      <td className="px-3 py-2 text-blue-400">{row.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-400">{row.codigoFiscal}</td>
                      <td className="px-3 py-2 text-slate-300">{row.invoiceType}</td>
                      <td className="px-3 py-2 text-slate-400">{row.tariff}</td>
                      <td className="px-3 py-2 text-slate-400">{row.postalCode}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{formatCurrency(row.energiaConsumida)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{formatCurrency(row.importeIVA)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-200">{formatCurrency(row.baseImponibleFactura)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{formatCurrency(row.baseImponibleF1)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{formatCurrency(row.importeImpuesto)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{formatCurrency(row.importeBonoSocial)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-200">{formatCurrency(row.baseImponibleTasaMunicipal)}</td>
                      <td className="px-3 py-2 text-right font-bold text-rose-400">{formatCurrency(row.tasaMunicipal)}</td>
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
        <div className="fixed bottom-0 left-0 right-0 md:left-64 lg:left-[260px] bg-slate-900 border-t border-slate-800 p-4 shadow-2xl z-40">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-center items-center gap-4">
            <div className="flex rounded-lg overflow-hidden border border-rose-500/30 shadow-[0_0_15px_rgba(225,29,72,0.1)]">
              <div className="bg-rose-600 text-white px-6 py-3 text-center flex flex-col justify-center">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90">Total Base Imponible</span>
                <span className="text-xl font-bold">{formatCurrency(totalBase)} €</span>
              </div>
              <div className="bg-rose-500 text-white px-6 py-3 text-center flex flex-col justify-center">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90">Total Tasa Municipal</span>
                <span className="text-xl font-bold">{formatCurrency(totalTasa)} €</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
