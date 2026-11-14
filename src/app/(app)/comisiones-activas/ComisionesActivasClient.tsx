'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getActiveCommissionsAction } from '@/app/actions/comisionesActions';
import { RefreshCcw, Calculator, TrendingUp, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Channel {
  id: string;
  name: string;
}

interface Props {
  channels: Channel[];
}

export default function ComisionesActivasClient({ channels }: Props) {
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [channelId, setChannelId] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    totalActiveCommission: number;
    validContractsCount: number;
    details?: any[];
  } | null>(null);

  const calculate = async () => {
    if (!targetDate) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await getActiveCommissionsAction(targetDate, channelId);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        toast.error(res.error || 'Error calculando comisiones');
      }
    } catch {
      toast.error('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const filteredDetails = useMemo(() => {
    const list = result?.details || [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) =>
        (d.titular || '').toLowerCase().includes(q) ||
        (d.codigoContrato || '').toLowerCase().includes(q) ||
        (d.cups || '').toLowerCase().includes(q) ||
        (d.canal || '').toLowerCase().includes(q)
    );
  }, [result, searchTerm]);

  const exportToXLSX = () => {
    if (!result?.details || result.details.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    import('xlsx')
      .then((XLSX) => {
        const rnd2 = (v: any) => Number(Number(v || 0).toFixed(2));
        const formatExcelDate = (dString: any) => {
          if (!dString) return '-';
          return new Date(dString).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
        };

        const headers = [
          'Titular',
          'Código Contrato',
          'Canal',
          'Tarifa',
          'Producto',
          'CUPS',
          'Fecha Alta V0',
          'Días Amortizados',
          'Días Pendientes',
          'Comisión Original (€)',
          'Parte Amortizada (€)',
          'Saldo Activo (€)',
        ];
        const rows = result.details!.map((d) => [
          d.titular,
          d.codigoContrato,
          d.canal,
          d.tarifa,
          d.producto,
          d.cups,
          formatExcelDate(d.fechaAltaV0),
          d.diasTranscurridos,
          d.diasPendientes,
          rnd2(d.comisionOriginal),
          rnd2(d.parteAmortizada),
          rnd2(d.parteActiva),
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Comisiones Activas');

        XLSX.writeFile(wb, `comisiones_activas_${targetDate}.xlsx`);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Error al generar el archivo Excel');
      });
  };

  useEffect(() => {
    calculate();
  }, []);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="card p-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-400 mb-1">Fecha de Corte (Cierre de Día)</label>
          <input
            type="date"
            className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-400 mb-1">Canal</label>
          <select
            className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          >
            <option value="todos">Todos los canales</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={calculate}
            disabled={loading}
            className="bg-[var(--lime)] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#c2ff66] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            <span>Calcular</span>
          </button>

          {result?.details && result.details.length > 0 && (
            <button
              onClick={exportToXLSX}
              className="bg-slate-800 border border-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
              title="Exportar detalles a Excel"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Resultados */}
      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group border border-[var(--lime)]/30">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--lime)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <TrendingUp className="w-12 h-12 text-[var(--lime)] mb-4" />
              <h3 className="text-gray-400 text-lg font-medium mb-1">Comisión Activa Total (Saldo Vivo)</h3>
              <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {result.totalActiveCommission.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-sm text-gray-500 mt-4">
                Importe pendiente de amortizar a cierre del{' '}
                {new Date(`${targetDate}T12:00:00Z`).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}
              </p>
            </div>

            <div className="card p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-gray-400 text-lg font-medium mb-1">Contratos en Amortización</h3>
              <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">{result.validContractsCount}</p>
              <p className="text-sm text-gray-500 mt-4">
                Expedientes activos dentro de su primer año (365 días) con comisión &gt; 0 €
              </p>
            </div>
          </div>

          {result.details && result.details.length > 0 && (
            <div className="card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Desglose por Contrato ({filteredDetails.length})
                </h3>
                <div className="relative w-full md:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar titular, contrato, CUPS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--lime)]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-400">
                  <thead className="text-xs uppercase bg-gray-800/50 text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="px-2 py-2 text-[11px]">Titular</th>
                      <th className="px-2 py-2 text-[11px]">Código Contrato</th>
                      <th className="px-2 py-2 text-[11px]">Canal</th>
                      <th className="px-2 py-2 text-[11px]">Tarifa</th>
                      <th className="px-2 py-2 text-[11px]">CUPS</th>
                      <th className="px-2 py-2 text-[11px]">Fecha Alta V0</th>
                      <th className="px-2 py-2 text-[11px] text-center">Días Pendientes</th>
                      <th className="px-2 py-2 text-[11px] text-right">Comisión Inicial</th>
                      <th className="px-2 py-2 text-[11px] text-right">Amortizado</th>
                      <th className="px-2 py-2 text-[11px] text-right">Saldo Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetails.map((d, idx) => (
                      <tr key={d.id || idx} className="border-b border-gray-800 hover:bg-gray-800/20">
                        <td className="px-2 py-2 text-[11px] font-medium text-white">{d.titular}</td>
                        <td className="px-2 py-2 text-[11px]">
                          {d.id && d.codigoContrato !== '-' ? (
                            <Link
                              href={`/contratos/${d.id}`}
                              className="text-indigo-400 hover:text-[var(--lime)] hover:underline transition-colors font-medium"
                            >
                              {d.codigoContrato}
                            </Link>
                          ) : (
                            <span>{d.codigoContrato}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-gray-300">{d.canal}</td>
                        <td className="px-2 py-2 text-[11px]">{d.tarifa}</td>
                        <td className="px-2 py-2 text-[11px] font-mono text-xs">{d.cups}</td>
                        <td className="px-2 py-2 text-[11px]">
                          {d.fechaAltaV0
                            ? new Date(d.fechaAltaV0).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })
                            : '-'}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                            {d.diasPendientes} / 365
                          </span>
                        </td>
                        <td className="px-2 py-2 text-[11px] text-right text-gray-300">
                          {Number(d.comisionOriginal || 0).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-right text-gray-400">
                          {Number(d.parteAmortizada || 0).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-right font-semibold text-[var(--lime)]">
                          {Number(d.parteActiva || 0).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
