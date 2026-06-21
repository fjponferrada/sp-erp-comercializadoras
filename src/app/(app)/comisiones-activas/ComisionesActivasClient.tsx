'use client';

import React, { useState, useEffect } from 'react';
import { getActiveCommissionsAction } from '@/app/actions/comisionesActions';
import { RefreshCcw, Calculator, TrendingUp, Download } from 'lucide-react';
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
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ totalActiveCommission: number; validContractsCount: number; details?: any[] } | null>(null);

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
    } catch (err) {
      toast.error('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const exportToXLSX = () => {
    if (!result?.details || result.details.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    import('xlsx').then((XLSX) => {
      const headers = ['Titular', 'Codigo Contrato', 'CUPS', 'Comision Original', 'Parte Amortizada', 'Parte Activa'];
      const rows = result.details!.map(d => [
        d.titular,
        d.codigoContrato,
        d.cups,
        d.comisionOriginal,
        d.parteAmortizada,
        d.parteActiva
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Comisiones Activas');

      XLSX.writeFile(wb, `comisiones_activas_${targetDate}.xlsx`);
    }).catch(err => {
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
          <label className="block text-sm font-medium text-gray-400 mb-1">Fecha de Cálculo</label>
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
          
          {result?.details && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--lime)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <TrendingUp className="w-12 h-12 text-[var(--lime)] mb-4" />
            <h3 className="text-gray-400 text-lg font-medium mb-1">Comisión Activa Total</h3>
            <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {result.totalActiveCommission.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Importe pendiente de amortizar a fecha {new Date(targetDate).toLocaleDateString('es-ES')}
            </p>
          </div>

          <div className="card p-8 flex flex-col items-center justify-center text-center">
            <h3 className="text-gray-400 text-lg font-medium mb-1">Contratos Computados</h3>
            <p className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {result.validContractsCount}
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Contratos en estado activo con comisión {'>'} 0€
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
