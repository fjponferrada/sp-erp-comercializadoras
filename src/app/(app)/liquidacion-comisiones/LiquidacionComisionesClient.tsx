'use client';

import React, { useState, useEffect } from 'react';
import { getLiquidacionComisionesAction, recalculateCommissionAction, updateManualCommissionAction } from '@/app/actions/liquidacionActions';
import { RefreshCcw, Calculator, Wallet, Download, TrendingDown, TrendingUp, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Channel {
  id: string;
  name: string;
}

interface Props {
  channels: Channel[];
}

export default function LiquidacionComisionesClient({ channels }: Props) {
  const now = new Date();
  const firstOfLastMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  const lastOfLastMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0));

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(formatDate(firstOfLastMonth));
  const [endDate, setEndDate] = useState<string>(formatDate(lastOfLastMonth));

  const [decommStartDate, setDecommStartDate] = useState<string>(formatDate(firstOfLastMonth));
  const [decommEndDate, setDecommEndDate] = useState<string>(formatDate(lastOfLastMonth));

  const [channelId, setChannelId] = useState<string>('todos');
  const [mode, setMode] = useState<'upfront' | 'carterizada'>('upfront');
  
  const getDefaultCutoff = (end: string) => {
    if (!end) return '';
    const d = new Date(end);
    // 11th of the month following the endDate month
    const cutoff = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 11));
    return cutoff.toISOString().split('T')[0];
  };

  const [cutoffDate, setCutoffDate] = useState<string>(getDefaultCutoff(formatDate(lastOfLastMonth)));

  useEffect(() => {
    if (endDate) {
      setCutoffDate(getDefaultCutoff(endDate));
    }
  }, [endDate]);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ 
    totalLiquidacion: number; 
    commissions: any[]; 
    decommissions: any[]; 
    carterizadas: any[] 
  } | null>(null);

  // Modal de edición manual
  const [editingCommission, setEditingCommission] = useState<{ id: string, value: number, titular: string, codigoContrato: string } | null>(null);
  const [manualValue, setManualValue] = useState<string>('');

  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedContracts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (!result) return;
    const allIds = [
      ...(mode === 'upfront' ? result.commissions.map(c => c.id) : []),
      ...(mode === 'carterizada' ? result.carterizadas.map(c => c.id) : [])
    ];
    const uniqueIds = Array.from(new Set(allIds));
    if (selectedContracts.length === uniqueIds.length) {
      setSelectedContracts([]);
    } else {
      setSelectedContracts(uniqueIds);
    }
  };

  const handleBulkRecalculate = async () => {
    if (selectedContracts.length === 0) return;
    if (!confirm(`¿Seguro que deseas recalcular ${selectedContracts.length} contratos seleccionados?`)) return;
    
    setLoading(true);
    let successCount = 0;
    try {
      for (const id of selectedContracts) {
        const res = await recalculateCommissionAction(id);
        if (res.success) successCount++;
      }
      toast.success(`${successCount} contratos recalculados.`);
      setSelectedContracts([]);
      await handleCalculate();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditManual = async () => {
    if (!editingCommission) return;
    const numValue = parseFloat(manualValue);
    if (isNaN(numValue)) {
      toast.error('Valor no válido');
      return;
    }

    setLoading(true);
    try {
      const res = await updateManualCommissionAction(editingCommission.id, numValue);
      if (res.success) {
        toast.success('Comisión editada manualmente');
        setEditingCommission(null);
        await handleCalculate(); // Recalcular todo
      } else {
        toast.error(res.error || 'Error al editar comisión');
      }
    } catch (error) {
      toast.error('Error al editar comisión');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await getLiquidacionComisionesAction(startDate, endDate, decommStartDate, decommEndDate, channelId, mode, cutoffDate);
      if (res.success && res.data) {
        setResult(res.data);
        setSelectedContracts([]);
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToXLSX = () => {
    if (!result) return;
    
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();

      if (mode === 'upfront') {
        // Hoja 1: Comisiones
        const headersCom = ['Titular', 'Codigo Contrato', 'Tarifa', 'Consumo Anual (MWh)', 'CUPS', 'Comision Original', 'Importe Liquidado'];
        const rowsCom = result.commissions.map(d => [d.titular, d.codigoContrato, d.tarifa, d.consumoAnual, d.cups, d.comisionOriginal, d.importeLiquidado]);
        const wsCom = XLSX.utils.aoa_to_sheet([headersCom, ...rowsCom]);
        XLSX.utils.book_append_sheet(wb, wsCom, 'Comisiones');

        const headersDec = ['Titular', 'Codigo Contrato', 'Tarifa', 'Consumo Anual (MWh)', 'CUPS', 'Comision Original', 'Días Activos Reales', 'Días a Devolver', 'Importe Decomisión'];

        // Hoja 2: Decomisiones 2.0TD
        const dec20 = result.decommissions.filter(d => d.tarifa === '2.0TD');
        if (dec20.length > 0) {
          const rowsDec20 = dec20.map(d => [d.titular, d.codigoContrato, d.tarifa, d.consumoAnual, d.cups, d.comisionOriginal, d.diasActivos, d.diasComputados, d.importeLiquidado]);
          const wsDec20 = XLSX.utils.aoa_to_sheet([headersDec, ...rowsDec20]);
          XLSX.utils.book_append_sheet(wb, wsDec20, 'Decomisiones 2.0TD');
        }

        // Hoja 3: Decomisiones Resto
        const decResto = result.decommissions.filter(d => d.tarifa !== '2.0TD');
        if (decResto.length > 0) {
          const headersDecResto = ['Titular', 'Codigo Contrato', 'Tarifa', 'Consumo Anual (MWh)', 'CUPS', 'Días Activos', 'Comisión Original', 'Comisión Real', 'Diferencia (Regularización)'];
          const rowsDecResto = decResto.map(d => [d.titular, d.codigoContrato, d.tarifa, d.consumoAnual, d.cups, d.diasActivos, d.comisionOriginal, d.comisionOriginal + d.importeLiquidado, d.importeLiquidado]);
          const wsDecResto = XLSX.utils.aoa_to_sheet([headersDecResto, ...rowsDecResto]);
          XLSX.utils.book_append_sheet(wb, wsDecResto, 'Decomisiones Resto');
        }
      } else {
        // Hoja única: Carterizadas
        const headersCar = ['Titular', 'Codigo Contrato', 'Tarifa', 'Consumo Anual (MWh)', 'CUPS', 'Comision Original', 'Días Devengados en el Mes', 'Importe Liquidado'];
        const rowsCar = result.carterizadas.map(d => [d.titular, d.codigoContrato, d.tarifa, d.consumoAnual, d.cups, d.comisionOriginal, d.diasComputados, d.importeLiquidado]);
        const wsCar = XLSX.utils.aoa_to_sheet([headersCar, ...rowsCar]);
        XLSX.utils.book_append_sheet(wb, wsCar, 'Carterizadas');
      }

      XLSX.writeFile(wb, `liquidacion_${mode}_${startDate}_a_${endDate}.xlsx`);
    }).catch(err => {
      console.error(err);
      toast.error('Error al generar el archivo Excel');
    });
  };



  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="col-span-1 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Modalidad</label>
            <select
              className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="upfront">Upfront (Pago Inmediato)</option>
              <option value="carterizada">Carterizada (Mensualizada)</option>
            </select>
          </div>
          
          <div className="col-span-1 lg:col-span-2">
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

          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-1" title="Contratos que causen baja definitiva antes de esta fecha se ignorarán">
              Límite Bajas Prematuras
            </label>
            <input
              type="date"
              className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Desde (Fecha Activación)</label>
            <input
              type="date"
              className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Hasta (Fecha Activación)</label>
            <input
              type="date"
              className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Desde (Fecha Baja)</label>
            <input
              type="date"
              className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
              value={decommStartDate}
              onChange={(e) => setDecommStartDate(e.target.value)}
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Hasta (Fecha Baja)</label>
            <input
              type="date"
              className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[var(--lime)]"
              value={decommEndDate}
              onChange={(e) => setDecommEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 w-full mt-6 justify-end">
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="bg-[var(--lime)] text-black font-semibold px-6 py-2 rounded-lg hover:bg-[#c2ff66] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            <span>Calcular</span>
          </button>
          
          {selectedContracts.length > 0 && (
            <button
              onClick={handleBulkRecalculate}
              disabled={loading}
              className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              title="Recalcular seleccionados"
            >
              <RefreshCcw className="w-5 h-5" />
              <span className="hidden md:inline">Recalcular ({selectedContracts.length})</span>
            </button>
          )}
          
          {result && (
            <button
              onClick={exportToXLSX}
              className="bg-slate-800 border border-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mode === 'upfront' && (
              <>
                <div className="card p-6 flex flex-col items-center justify-center text-center">
                  <TrendingUp className="w-8 h-8 text-green-400 mb-2" />
                  <h3 className="text-gray-400 text-sm font-medium mb-1">Total Comisiones (+)</h3>
                  <p className="text-2xl font-bold text-green-400">
                    {result.commissions.reduce((a,b) => a + b.importeLiquidado, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{result.commissions.length} contratos activados</p>
                </div>
                <div className="card p-6 flex flex-col items-center justify-center text-center">
                  <TrendingDown className="w-8 h-8 text-red-400 mb-2" />
                  <h3 className="text-gray-400 text-sm font-medium mb-1">Total Decomisiones (-)</h3>
                  <p className="text-2xl font-bold text-red-400">
                    {result.decommissions.reduce((a,b) => a + b.importeLiquidado, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{result.decommissions.length} bajas anticipadas</p>
                </div>
                <div className="card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group border border-[var(--lime)]/30">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--lime)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Wallet className="w-8 h-8 text-[var(--lime)] mb-2" />
                  <h3 className="text-gray-400 text-sm font-medium mb-1">Total Neto a Liquidar</h3>
                  <p className="text-3xl font-bold text-white">
                    {result.totalLiquidacion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </>
            )}

            {mode === 'carterizada' && (
               <div className="col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="card p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group border border-[var(--lime)]/30">
                   <div className="absolute inset-0 bg-gradient-to-br from-[var(--lime)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                   <Wallet className="w-12 h-12 text-[var(--lime)] mb-4" />
                   <h3 className="text-gray-400 text-lg font-medium mb-1">Total Devengado</h3>
                   <p className="text-4xl lg:text-5xl font-bold text-white">
                     {result.totalLiquidacion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                   </p>
                 </div>
                 <div className="card p-8 flex flex-col items-center justify-center text-center">
                   <h3 className="text-gray-400 text-lg font-medium mb-1">Contratos Computados</h3>
                   <p className="text-4xl lg:text-5xl font-bold text-white">
                     {result.carterizadas.length}
                   </p>
                 </div>
               </div>
            )}
          </div>

          {/* Tablas Visuales */}
          <div className="grid grid-cols-1 gap-6">
            {mode === 'upfront' && (
              <>
                {result.commissions.length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-green-400"/> Comisiones por Alta</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs uppercase bg-gray-800/50 text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="px-2 py-2 text-[11px] w-10">
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                                onChange={selectAll}
                                checked={result.commissions.length > 0 && result.commissions.every(c => selectedContracts.includes(c.id))}
                              />
                            </th>
                            <th className="px-2 py-2 text-[11px]">Titular</th>
                            <th className="px-2 py-2 text-[11px]">Código Contrato</th>
                            <th className="px-2 py-2 text-[11px]">Producto</th>
                            <th className="px-2 py-2 text-[11px]">Tarifa</th>
                            <th className="px-2 py-2 text-[11px] min-w-[150px]">Potencias (kW)</th>
                            <th className="px-2 py-2 text-[11px]">Consumo Anual</th>
                            <th className="px-2 py-2 text-[11px]">CUPS</th>
                            <th className="px-2 py-2 text-[11px] text-right">Comisión a Pagar</th>
                            <th className="px-2 py-2 text-[11px] text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.commissions.map((c, i) => (
                            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                              <td className="px-2 py-2 text-[11px]">
                                <input 
                                  type="checkbox"
                                  className="rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                                  checked={selectedContracts.includes(c.id)}
                                  onChange={() => toggleSelection(c.id)}
                                />
                              </td>
                              <td className="px-2 py-2 text-[11px] font-medium text-white">{c.titular}</td>
                              <td className="px-2 py-2 text-[11px] font-medium text-gray-300">{c.codigoContrato}</td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">
                                <div className="max-w-[180px] xl:max-w-[250px] whitespace-normal leading-snug">
                                  {c.producto}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">{c.tarifa}</td>
                              <td className="px-2 py-2 text-[11px] text-xs text-gray-500 font-mono">
                                {c.potencias && c.potencias.some((p: number) => p > 0) ? c.potencias.map((p: number, idx: number) => p > 0 ? `P${idx+1}:${p}` : '').filter(Boolean).join(' | ') : '-'}
                              </td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">{c.consumoAnual} MWh</td>
                              <td className="px-2 py-2 text-[11px]">{c.cups}</td>
                              <td className="px-2 py-2 text-[11px] text-right text-green-400 font-semibold">{c.importeLiquidado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                              <td className="px-2 py-2 text-[11px] text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingCommission({ id: c.id, value: c.importeLiquidado, titular: c.titular, codigoContrato: c.codigoContrato });
                                      setManualValue(c.importeLiquidado.toString());
                                    }}
                                    disabled={loading}
                                    className="text-xs font-semibold px-2 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    title="Editar comisión manualmente"
                                  >
                                    <Edit2 size={12} /> Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {result.decommissions.filter(c => c.tarifa === '2.0TD').length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2"><TrendingDown size={20} className="text-red-400"/> Decomisiones por Baja Anticipada (2.0TD)</h3>
                    <p className="text-xs text-slate-400 mb-4">* Se omiten automáticamente aquellas decomisiones menores a 1 € para no generar movimientos con cantidades despreciables (céntimos).</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs uppercase bg-gray-800/50 text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="px-2 py-2 text-[11px]">Titular</th>
                            <th className="px-2 py-2 text-[11px]">Código Contrato</th>
                            <th className="px-2 py-2 text-[11px]">Producto</th>
                            <th className="px-2 py-2 text-[11px]">Tarifa</th>
                            <th className="px-2 py-2 text-[11px] min-w-[150px]">Potencias (kW)</th>
                            <th className="px-2 py-2 text-[11px]">Consumo Anual</th>
                            <th className="px-2 py-2 text-[11px]">Días Activos</th>
                            <th className="px-2 py-2 text-[11px]">Días a Devolver</th>
                            <th className="px-2 py-2 text-[11px] text-right">Importe a Devolver</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.decommissions.filter(c => c.tarifa === '2.0TD').map((c, i) => (
                            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                              <td className="px-2 py-2 text-[11px] font-medium text-white">{c.titular}</td>
                              <td className="px-2 py-2 text-[11px] font-medium text-gray-300">{c.codigoContrato}</td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">
                                <div className="max-w-[180px] xl:max-w-[250px] whitespace-normal leading-snug">
                                  {c.producto}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">{c.tarifa}</td>
                              <td className="px-2 py-2 text-[11px] text-xs text-gray-500 font-mono">
                                {c.potencias && c.potencias.some((p: number) => p > 0) ? c.potencias.map((p: number, idx: number) => p > 0 ? `P${idx+1}:${p}` : '').filter(Boolean).join(' | ') : '-'}
                              </td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">{c.consumoAnual} MWh</td>
                              <td className="px-2 py-2 text-[11px]">{c.diasActivos} días</td>
                              <td className="px-2 py-2 text-[11px]">{c.diasComputados} días</td>
                              <td className="px-2 py-2 text-[11px] text-right text-red-400 font-semibold">-{c.importeLiquidado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {result.decommissions.filter(c => c.tarifa !== '2.0TD').length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><TrendingDown size={20} className="text-red-400"/> Decomisiones por Baja Anticipada (Resto Tarifas)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs uppercase bg-gray-800/50 text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="px-2 py-2 text-[11px]">Titular</th>
                            <th className="px-2 py-2 text-[11px]">Código Contrato</th>
                            <th className="px-2 py-2 text-[11px]">Producto</th>
                            <th className="px-2 py-2 text-[11px]">Tarifa</th>
                            <th className="px-2 py-2 text-[11px] min-w-[150px]">Potencias (kW)</th>
                            <th className="px-2 py-2 text-[11px]">Consumo Anual</th>
                            <th className="px-2 py-2 text-[11px]">Días Activos</th>
                            <th className="px-2 py-2 text-[11px] text-right">Comisión Inicial</th>
                            <th className="px-2 py-2 text-[11px] text-right">Comisión Real</th>
                            <th className="px-2 py-2 text-[11px] text-right">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.decommissions.filter(c => c.tarifa !== '2.0TD').map((c, i) => (
                            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                              <td className="px-2 py-2 text-[11px] font-medium text-white">{c.titular}</td>
                              <td className="px-2 py-2 text-[11px] font-medium text-gray-300">{c.codigoContrato}</td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">
                                <div className="max-w-[180px] xl:max-w-[250px] whitespace-normal leading-snug">
                                  {c.producto}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">{c.tarifa}</td>
                              <td className="px-2 py-2 text-[11px] text-xs text-gray-500 font-mono">
                                {c.potencias && c.potencias.some((p: number) => p > 0) ? c.potencias.map((p: number, idx: number) => p > 0 ? `P${idx+1}:${p}` : '').filter(Boolean).join(' | ') : '-'}
                              </td>
                              <td className="px-2 py-2 text-[11px] text-gray-400">{c.consumoAnual} MWh</td>
                              <td className="px-2 py-2 text-[11px]">{c.diasActivos} días</td>
                              <td className="px-2 py-2 text-[11px] text-right text-gray-400">{c.comisionOriginal?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                              <td className="px-2 py-2 text-[11px] text-right text-gray-400">{c.comisionReal?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                              <td className={`px-2 py-2 text-[11px] text-right font-semibold ${c.importeLiquidado < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {c.importeLiquidado > 0 ? '+' : ''}{c.importeLiquidado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
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

            {mode === 'carterizada' && result.carterizadas.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Contratos Devengados</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs uppercase bg-gray-800/50 text-gray-400 border-b border-gray-800">
                      <tr>
                        <th className="px-2 py-2 text-[11px] w-10">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                            onChange={selectAll}
                            checked={result.carterizadas.length > 0 && result.carterizadas.every(c => selectedContracts.includes(c.id))}
                          />
                        </th>
                        <th className="px-2 py-2 text-[11px]">Titular</th>
                        <th className="px-2 py-2 text-[11px]">Código Contrato</th>
                        <th className="px-2 py-2 text-[11px]">Producto</th>
                        <th className="px-2 py-2 text-[11px]">Tarifa</th>
                        <th className="px-2 py-2 text-[11px] min-w-[150px]">Potencias (kW)</th>
                        <th className="px-2 py-2 text-[11px]">Consumo Anual</th>
                        <th className="px-2 py-2 text-[11px]">Días Devengados</th>
                        <th className="px-2 py-2 text-[11px] text-right">Importe Devengado</th>
                        <th className="px-2 py-2 text-[11px] text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.carterizadas.map((c, i) => (
                        <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/20">
                          <td className="px-2 py-2 text-[11px]">
                            <input 
                              type="checkbox"
                              className="rounded border-gray-700 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                              checked={selectedContracts.includes(c.id)}
                              onChange={() => toggleSelection(c.id)}
                            />
                          </td>
                          <td className="px-2 py-2 text-[11px] font-medium text-white">{c.titular}</td>
                          <td className="px-2 py-2 text-[11px] font-medium text-gray-300">{c.codigoContrato}</td>
                          <td className="px-2 py-2 text-[11px] text-gray-400">
                            <div className="max-w-[180px] xl:max-w-[250px] whitespace-normal leading-snug">
                              {c.producto}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-[11px] text-gray-400">{c.tarifa}</td>
                          <td className="px-2 py-2 text-[11px] text-xs text-gray-500 font-mono">
                            {c.potencias && c.potencias.some((p: number) => p > 0) ? c.potencias.map((p: number, idx: number) => p > 0 ? `P${idx+1}:${p}` : '').filter(Boolean).join(' | ') : '-'}
                          </td>
                          <td className="px-2 py-2 text-[11px] text-gray-400">{c.consumoAnual} MWh</td>
                          <td className="px-2 py-2 text-[11px]">{c.diasComputados} días</td>
                          <td className="px-2 py-2 text-[11px] text-right text-[var(--lime)] font-semibold">{c.importeLiquidado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                          <td className="px-2 py-2 text-[11px] text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingCommission({ id: c.id, value: c.importeLiquidado, titular: c.titular, codigoContrato: c.codigoContrato });
                                  setManualValue(c.importeLiquidado.toString());
                                }}
                                disabled={loading}
                                className="text-xs font-semibold px-2 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                                title="Editar comisión manualmente"
                              >
                                <Edit2 size={12} /> Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Edición Manual */}
      {editingCommission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-lg font-bold text-white">Editar Comisión</h2>
              <button onClick={() => setEditingCommission(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-400 mb-4">
                Editando comisión de <strong>{editingCommission.titular}</strong> ({editingCommission.codigoContrato})
              </p>
              <label className="block text-sm font-medium text-slate-300 mb-2">Comisión Final (€)</label>
              <input
                type="number" step="0.01"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-bold focus:outline-none focus:border-indigo-500"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
              />
            </div>
            <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-3">
              <button onClick={() => setEditingCommission(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={handleEditManual} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
