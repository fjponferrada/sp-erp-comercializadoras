'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import CreateTicketModal from '@/components/incidencias/CreateTicketModal';
import { Eye, Plus, MessageSquare } from 'lucide-react';

export default function IncidenciasClient({ userBrands }: { userBrands: any[] }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [selectedNivel, setSelectedNivel] = useState('Nivel 1 - Comercializadora');
  const [selectedEstado, setSelectedEstado] = useState('Todas');
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedNivel) query.append('nivel', selectedNivel);
      if (selectedEstado) query.append('estado', selectedEstado);

      const res = await fetch(`/api/tickets?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [selectedNivel, selectedEstado]);

  return (
    <>
      <Topbar title="Tickets / Incidencias" subtitle="Gestión de reclamaciones e incidencias" />
      
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        
        {/* Panel Superior: Filtros */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Nivel de Acceso</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              value={selectedNivel}
              onChange={e => setSelectedNivel(e.target.value)}
            >
              <option value="Nivel 1 - Comercializadora">Nivel 1 - Comercializadora</option>
              <option value="Nivel 2 - Administrador">Nivel 2 - Administrador</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-400 font-semibold mb-2 block uppercase tracking-wider">Estado del Ticket</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              value={selectedEstado}
              onChange={e => setSelectedEstado(e.target.value)}
            >
              <option value="Pendientes">Pendientes de resolución</option>
              <option value="Nuevas">Nuevas sin atender</option>
              <option value="Todas">Todas</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3 ml-auto w-full sm:w-auto mt-2 sm:mt-0">
            <button 
              onClick={loadTickets} 
              className="flex-1 sm:flex-none bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Eye size={16} /> Consultar
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none bg-lime-400 hover:bg-lime-500 text-slate-900 font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <Plus size={18} /> Crear Ticket
            </button>
          </div>
        </div>

        {/* Listado de Tickets */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">ID / Ref</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Últ. Actividad</th>
                  <th className="px-6 py-4">CUPS</th>
                  <th className="px-6 py-4">Motivo / Tipo</th>
                  <th className="px-6 py-4">Abierto por</th>
                  <th className="px-6 py-4 text-center">Respuestas</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="h-4 w-24 bg-slate-700 rounded"></div>
                        <div className="text-xs">Cargando tickets...</div>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <MessageSquare className="text-slate-600 mb-2" size={32} />
                        <div>No hay tickets que coincidan con estos filtros</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tickets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-rose-400 font-medium">#{t.id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-slate-400">{new Date(t.lastActivityAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono text-xs">{t.supplyPoint?.cups || '-'}</td>
                      <td className="px-6 py-4 text-slate-200">{t.motivo}</td>
                      <td className="px-6 py-4">{t.openedBy?.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-900 text-slate-300 px-2 py-1 rounded border border-slate-700 text-xs">
                          {t.numRespuestas}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {t.estado === 'NUEVA' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded">
                            NUEVA
                          </span>
                        ) : t.estado === 'RESUELTA' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
                            RESUELTA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded">
                            {t.estado}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded transition-colors" title="Ver Ticket">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateTicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        brands={userBrands} 
        onCreated={() => {
          setSelectedEstado('Nuevas');
          loadTickets();
        }}
      />
    </>
  );
}
