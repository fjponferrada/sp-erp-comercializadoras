'use client';

import React, { useState, useEffect } from 'react';
import { fetchPendingSwitchingContracts, generateSwitchingXmls } from '@/app/actions/switchingGenerarActions';
import { Loader2, Download, CheckSquare, Square, Eye, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ContractRow {
  id: string;
  cups: string;
  direccion: string;
  nif: string;
  nombre: string;
  proceso: string;
  tipoC2: string | null;
  contrato: string;
  codDistribuidora: string;
  codComercializadora: string;
  estado: string;
  hasAnexo?: boolean;
}

export default function GenerarSwitchingClient() {
  const [data, setData] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<{ contrato: string; motivo: string }[]>([]);
  
  // Para paginación local o filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACEPTADO');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPendingSwitchingContracts();
      if (res.success) {
        setData(res.data as ContractRow[]);
      } else {
        setError(res.error || 'Error al cargar los contratos');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    setError(null);
    setValidationWarnings([]);
    try {
      const ids = Array.from(selectedIds);
      const res = await generateSwitchingXmls(ids);
      
      if (res.success && res.fileContent) {
        // Download zip
        const link = document.createElement('a');
        link.href = `data:application/zip;base64,${res.fileContent}`;
        link.download = res.fileName || 'Switching_Generados.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Remove processed items EXCEPT the ones that failed validation
        const failedIds = new Set(res.validationErrors?.map((e: any) => e.contrato) || []);
        setData(prev => prev.filter(p => !selectedIds.has(p.id) || failedIds.has(p.contrato)));
        setSelectedIds(new Set());
        
        if (res.validationErrors && res.validationErrors.length > 0) {
           setValidationWarnings(res.validationErrors);
        }
      } else {
        setError(res.error || 'Error generando XMLs');
        if (res.validationErrors && res.validationErrors.length > 0) {
           setValidationWarnings(res.validationErrors);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const filteredData = data.filter(d => {
    const matchesSearch = d.cups.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.nif.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || (d.estado || '').toUpperCase() === statusFilter.toUpperCase();
    
    return matchesSearch && matchesStatus;
  });

  const uniqueStatuses = Array.from(new Set(data.map(d => (d.estado || '').toUpperCase()))).filter(Boolean).sort();
  if (!uniqueStatuses.includes('ACEPTADO')) uniqueStatuses.unshift('ACEPTADO'); // Ensure it exists in the list

  return (
    <div className="p-6 w-full max-w-[1800px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Banner Widget */}
      <div className="relative group overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8 text-center shadow-2xl transition-all hover:border-[var(--lime)]/50 hover:shadow-[0_0_30px_rgba(205,255,100,0.1)]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--lime)]/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        <h2 className="text-[var(--lime)] text-sm font-bold mb-2 tracking-[0.2em] uppercase">Pendientes Iniciar</h2>
        <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 tracking-tighter drop-shadow-sm">
          {filteredData.length}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-[var(--lime)] rounded-full shadow-[0_0_10px_var(--lime)]" />
          <h1 className="text-3xl font-black text-white tracking-tight">GENERAR SWITCHING</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] transition-all shadow-inner w-full md:w-auto appearance-none cursor-pointer"
          >
            <option value="ALL">Todos los estados</option>
            {uniqueStatuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <div className="relative w-full md:w-80 group">
            <input 
              type="text"
              placeholder="Buscar por CUPS, NIF, Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] transition-all placeholder:text-slate-500 shadow-inner"
            />
            <svg className="absolute left-3 top-3.5 w-4 h-4 text-slate-500 group-focus-within:text-[var(--lime)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 font-bold mb-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <h3>Atención: Algunos contratos no se pudieron generar ({validationWarnings.length})</h3>
          </div>
          <ul className="list-disc pl-8 text-sm space-y-1">
            {validationWarnings.map((v, idx) => (
              <li key={idx}>Contrato <span className="font-mono">{v.contrato}</span>: {v.motivo}</li>
            ))}
          </ul>
          <p className="text-xs text-yellow-500/80 italic mt-2">El resto de contratos seleccionados sí se han incluido en el .zip.</p>
        </div>
      )}

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pb-2">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-[10px] uppercase tracking-wider bg-slate-900/90 text-slate-400 border-b border-slate-700/50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-center w-14">
                  <button onClick={toggleSelectAll} className="hover:text-gray-200">
                    {selectedIds.size > 0 && selectedIds.size === filteredData.length ? <CheckSquare className="w-5 h-5 mx-auto" /> : <Square className="w-5 h-5 mx-auto" />}
                  </button>
                </th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">Cups</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">Dirección</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">NIF</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">Nombre</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">Proceso</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">Estado</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors whitespace-nowrap">Contrato</th>
                <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors text-center whitespace-nowrap">Cod Distribuidora</th>
                <th className="p-4 font-bold text-center w-16 whitespace-nowrap">Ver</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 text-[var(--lime)] animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    No hay contratos pendientes
                  </td>
                </tr>
              ) : (
                filteredData.map((row, i) => {
                  const isSelected = selectedIds.has(row.id);
                  const isMissingData = !row.cups || !row.nif || !row.codDistribuidora;
                  return (
                    <tr 
                      key={row.id} 
                      className={`border-b border-slate-800/50 hover:bg-slate-800/80 transition-all duration-200 group ${isSelected ? 'bg-[var(--lime)]/10 hover:bg-[var(--lime)]/15 border-l-2 border-l-[var(--lime)]' : 'border-l-2 border-l-transparent'} ${isMissingData ? 'bg-red-900/10 hover:bg-red-900/20 border-l-red-500' : ''}`}
                    >
                      <td className="p-4 text-center">
                        <button onClick={() => toggleSelect(row.id)} className="text-slate-500 hover:text-[var(--lime)] transition-colors transform hover:scale-110 active:scale-95">
                          {isSelected ? <CheckSquare className="w-5 h-5 mx-auto text-[var(--lime)]" /> : <Square className="w-5 h-5 mx-auto" />}
                        </button>
                      </td>
                      <td className="p-4 font-mono text-[13px] font-medium tracking-tight text-slate-200">{row.cups || <span className="text-red-400 text-xs px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/20">Falta CUPS</span>}</td>
                      <td className="p-4 truncate max-w-[250px] text-[13px]" title={row.direccion}>{row.direccion}</td>
                      <td className="p-4 text-[13px] font-medium">{row.nif || <span className="text-red-400 text-xs px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/20">Falta NIF</span>}</td>
                      <td className="p-4 truncate max-w-[200px] text-[13px] font-medium text-slate-200" title={row.nombre}>{row.nombre}</td>
                      <td className="p-4">
                        <span className="bg-slate-800 border border-slate-600 text-slate-300 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider shadow-sm">
                          {row.proceso}{row.tipoC2 ? `-${row.tipoC2}` : ''}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider border shadow-sm whitespace-nowrap ${
                          row.estado === 'PDTE_TRAMITAR' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                          row.estado === 'EN_PROCESO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          row.estado === 'RECHAZADO' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          row.estado === 'RECHAZO_DISTRIBUIDORA' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-slate-800 text-slate-400 border-slate-600'
                        }`}>
                          {row.estado?.replace(/_/g, ' ') || 'SIN ESTADO'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[13px] text-blue-400 transition-colors cursor-pointer group-hover:underline underline-offset-4 decoration-blue-500/30">
                        <div className="flex items-center gap-2">
                          <span className="hover:text-blue-300">{row.contrato}</span>
                          {row.proceso.startsWith('M1') && row.estado?.toUpperCase() === 'ACEPTADO' && !row.hasAnexo && (
                            <div className="group/alert relative flex items-center">
                              <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max px-3 py-1.5 bg-red-950 border border-red-500 text-red-200 text-[10px] uppercase font-bold tracking-wider rounded opacity-0 group-hover/alert:opacity-100 transition-opacity pointer-events-none z-50">
                                Falta Anexo Firmado
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center font-mono text-[13px]">{row.codDistribuidora || <span className="text-red-400 text-xs px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/20">Falta</span>}</td>
                      <td className="p-4 text-center">
                        <Link href={`/contratos/${row.id}`} className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-[var(--lime)] transition-all hover:scale-105 active:scale-95 shadow-sm border border-slate-700/50">
                           <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleGenerate}
          disabled={generating || selectedIds.size === 0}
          className="bg-[var(--lime)] hover:bg-[#b3ff3b] text-black font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(205,255,100,0.2)] hover:shadow-[0_0_30px_rgba(205,255,100,0.4)] hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {generating ? 'Generando ZIP...' : `Generar (${selectedIds.size})`}
        </button>
      </div>
    </div>
  );
}
