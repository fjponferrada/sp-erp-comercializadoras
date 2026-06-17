'use client';

import { useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-2">Año</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500/50"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-2">Trimestre</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500/50"
            >
              <option value="1">Primer Trimestre (Ene - Mar)</option>
              <option value="2">Segundo Trimestre (Abr - Jun)</option>
              <option value="3">Tercer Trimestre (Jul - Sep)</option>
              <option value="4">Cuarto Trimestre (Oct - Dic)</option>
            </select>
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Calculator className="text-rose-500 w-5 h-5" />
              Desglose Impuesto Eléctrico (T{quarter} {year})
            </h3>
          </div>
          
          {results.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No se encontraron facturas para este periodo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-medium">Zona (Agencia)</th>
                    <th className="px-6 py-4 font-medium text-center">Límite Mínimo</th>
                    <th className="px-6 py-4 font-medium text-right">Tipo Aplicado (%)</th>
                    <th className="px-6 py-4 font-medium text-right">Base Sujeta (€)</th>
                    <th className="px-6 py-4 font-medium text-right text-slate-500">Impuesto Base (€)</th>
                    <th className="px-6 py-4 font-medium text-right border-l border-slate-800">Consumo Mínimo (MWh)</th>
                    <th className="px-6 py-4 font-medium text-right text-slate-500">Impuesto Mínimo (€)</th>
                    <th className="px-6 py-4 font-medium text-right text-rose-400 bg-rose-500/5">Total Impuesto (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{row.zona}</td>
                      <td className="px-6 py-4 text-center">
                        {row.isMinApplied ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Sí</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300">{row.isMinApplied ? '-' : `${formatNumber(row.tipo)}%`}</td>
                      <td className="px-6 py-4 text-right text-slate-300">{row.isMinApplied ? '-' : formatCurrency(row.baseSujeta)}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{row.isMinApplied ? '-' : formatCurrency(row.impuestoBase)}</td>
                      <td className="px-6 py-4 text-right text-slate-300 border-l border-slate-800">{!row.isMinApplied ? '-' : formatNumber(row.consumoMinimo) + ' MWh'}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{!row.isMinApplied ? '-' : formatCurrency(row.impuestoMinimo)}</td>
                      <td className="px-6 py-4 text-right font-bold text-rose-400 bg-rose-500/5">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                  
                  {/* Totales Globales */}
                  <tr className="bg-slate-950 font-bold border-t-2 border-slate-800">
                    <td colSpan={3} className="px-6 py-4 text-white">TOTAL GENERAL</td>
                    <td className="px-6 py-4 text-right text-white">
                      {formatCurrency(results.reduce((acc, r) => acc + r.baseSujeta, 0))}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400">
                      {formatCurrency(results.reduce((acc, r) => acc + r.impuestoBase, 0))}
                    </td>
                    <td className="px-6 py-4 text-right text-white border-l border-slate-800">
                      {formatNumber(results.reduce((acc, r) => acc + r.consumoMinimo, 0))} MWh
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400">
                      {formatCurrency(results.reduce((acc, r) => acc + r.impuestoMinimo, 0))}
                    </td>
                    <td className="px-6 py-4 text-right text-rose-400 bg-rose-500/5">
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
  );
}
