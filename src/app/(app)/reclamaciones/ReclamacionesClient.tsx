'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileWarning, Search, RefreshCcw, Download } from 'lucide-react';
import { getClaimsAction, ClaimSummary } from '@/app/actions/claimsActions';
import toast from 'react-hot-toast';

interface ReclamacionesClientProps {
  initialClaims: ClaimSummary[];
  userRole: string;
}

export default function ReclamacionesClient({
  initialClaims,
  userRole
}: ReclamacionesClientProps) {
  const [claims, setClaims] = useState(initialClaims);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClaims = async () => {
    setLoading(true);
    const result = await getClaimsAction();
    if (result.success) {
      setClaims(result.data);
    } else {
      toast.error('Error recargando reclamaciones');
    }
    setLoading(false);
  };

  const formatDate = (dateString: Date | string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch (e) {
      return '-';
    }
  };

  const filteredClaims = claims.filter(c => 
    c.codigoSolicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cups?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.codigoReclamacion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen relative outline-none" style={{ background: 'var(--bg-base)' }}>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--lime)]">
              <FileWarning className="h-6 w-6" />
              Reclamaciones
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Listado general de procesos de reclamación (R1). Total: {filteredClaims.length}
            </p>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto items-center">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="Buscar CUPS, código..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg focus:ring-1 focus:ring-[var(--lime)] focus:border-[var(--lime)] text-sm text-gray-200 placeholder-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            </div>
            
            <button
              onClick={fetchClaims}
              disabled={loading}
              className="flex items-center justify-center p-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-gray-400 transition-colors"
              title="Recargar"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <a
              href="/reclamaciones/generar"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--lime)] text-[var(--bg-base)] font-semibold rounded-lg hover:bg-[#c9f07a] transition-colors"
            >
              Generar Reclamación
            </a>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border)] text-xs text-gray-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">Código Solicitud</th>
                  <th className="px-5 py-4">CUPS</th>
                  <th className="px-5 py-4">Cód. Distribuidora</th>
                  <th className="px-5 py-4 text-center">Días Abierta</th>
                  <th className="px-5 py-4">Paso 01</th>
                  <th className="px-5 py-4">Paso 02</th>
                  <th className="px-5 py-4">Comentarios Paso 03</th>
                  <th className="px-5 py-4">Resolución Paso 05</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                      No se encontraron reclamaciones.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim) => (
                    <tr key={claim.codigoSolicitud} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                      <td className="px-5 py-4 font-mono text-gray-400">
                        <div className="flex items-center gap-2">
                          {claim.codigoSolicitud}
                          {claim.paso01?.xmlUrl && (
                            <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-500 hover:text-[var(--lime)]">
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-gray-400">{claim.cups || '-'}</td>
                      <td className="px-5 py-4 font-mono text-gray-400">{claim.codigoReclamacion || '-'}</td>
                      <td className="px-5 py-4 font-bold text-center">
                        {claim.diasAbierta !== null ? claim.diasAbierta : '-'}
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                         {formatDate(claim.paso01?.fecha)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          {formatDate(claim.paso02?.fecha)}
                          {claim.paso02?.xmlUrl && (
                            <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs truncate" title={claim.paso03?.comentario || ''}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{claim.paso03?.comentario || '-'}</span>
                          {claim.paso03?.xmlUrl && (
                            <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs truncate" title={claim.paso05?.comentario || ''}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{claim.paso05?.comentario || '-'}</span>
                          {claim.paso05?.xmlUrl && (
                            <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
