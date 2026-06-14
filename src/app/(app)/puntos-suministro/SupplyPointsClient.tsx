'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import PaginationFooter from '@/components/PaginationFooter';
import { getPaginatedSupplyPointsAction } from '@/app/actions/supplyPointActions';
import EditSupplyPointModal from './EditSupplyPointModal';
import {
  Zap,
  Search,
  MapPin,
  Building2,
  FileCheck2,
  SlidersHorizontal,
  Edit,
  ExternalLink,
  Eye
} from 'lucide-react';
import Link from 'next/link';

export default function SupplyPointsClient({ 
  initialSupplyPoints, 
  initialTotalCount,
  userRole 
}: { 
  initialSupplyPoints: any[], 
  initialTotalCount: number,
  userRole: string 
}) {
  const [supplyPoints, setSupplyPoints] = useState(initialSupplyPoints);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSupplyPoint, setSelectedSupplyPoint] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchSupplyPoints = async () => {
      setLoading(true);
      const result = await getPaginatedSupplyPointsAction(page, limit, searchTerm);
      if (result.success) {
        setSupplyPoints(result.supplyPoints || []);
        setTotalCount(result.totalCount || 0);
      }
      setLoading(false);
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSupplyPoints();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, page, limit]);

  const handleEdit = (sp: any) => {
    setSelectedSupplyPoint(sp);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    // Refresh current page
    const fetchSupplyPoints = async () => {
      setLoading(true);
      const result = await getPaginatedSupplyPointsAction(page, limit, searchTerm);
      if (result.success) {
        setSupplyPoints(result.supplyPoints || []);
        setTotalCount(result.totalCount || 0);
      }
      setLoading(false);
    };
    fetchSupplyPoints();
  };

  return (
    <div className="flex-1 bg-black/40 h-[100vh] overflow-y-auto w-full relative">
      <Topbar title="Puntos de Suministro" />

      <div className="p-8 pb-32 max-w-[1600px] mx-auto w-full space-y-6">
        
        {/* Header and Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-lime-500/10 p-3 rounded-xl border border-lime-500/20">
              <Zap className="text-lime-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Suministros</h1>
              <p className="text-sm text-white/50">{totalCount} registros encontrados</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-lime-400 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar por CUPS, Dirección o Titular..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/50 transition-all placeholder:text-white/30"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/5">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">CUPS / Tarifa</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Titular</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Dirección</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Consumo</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Estado Contrato</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && supplyPoints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/50">Cargando puntos de suministro...</td>
                  </tr>
                ) : supplyPoints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/50">No se encontraron resultados</td>
                  </tr>
                ) : (
                  supplyPoints.map((sp) => (
                    <tr key={sp.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/5 p-2 rounded border border-white/10">
                            <Zap size={14} className="text-lime-400" />
                          </div>
                          <div>
                            <Link href={`/puntos-suministro/${sp.id}`} className="font-mono text-sm font-semibold text-gray-200 tracking-wider hover:text-lime-400 hover:underline transition-colors">
                              {sp.cups}
                            </Link>
                            <span className="text-xs font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                              {sp.tariff || 'S/D'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-white/40" />
                          <Link href={`/clientes/${sp.clientId}`} className="text-sm text-white/80 hover:text-lime-400 hover:underline font-medium transition-colors">
                            {sp.client?.businessName || 'Desconocido'}
                          </Link>
                        </div>
                        <div className="text-xs text-white/40 font-mono mt-1 ml-6">{sp.client?.vatNumber}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="text-white/40 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-white/70 line-clamp-1">{sp.address}</p>
                            <p className="text-xs text-white/40 mt-0.5">{sp.postalCode} - {sp.city} ({sp.province})</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-white/80">
                          {sp.annualConsumption ? `${sp.annualConsumption} MWh` : '-'}
                        </div>
                      </td>
                      <td className="p-4">
                        {sp.contracts && sp.contracts.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
                            </span>
                            <span className="text-xs font-medium text-lime-400 bg-lime-400/10 px-2.5 py-1 rounded-full border border-lime-400/20">
                              Activo
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-white/40">Sin Contrato Activo</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/puntos-suministro/${sp.id}`}
                            className="p-2 bg-white/5 hover:bg-lime-500/20 text-white/60 hover:text-lime-400 rounded-lg border border-white/5 hover:border-lime-500/30 transition-all"
                            title="Ver Detalle"
                          >
                            <Eye size={16} />
                          </Link>
                          <button
                            onClick={() => handleEdit(sp)}
                            className="p-2 bg-white/5 hover:bg-lime-500/20 text-white/60 hover:text-lime-400 rounded-lg border border-white/5 hover:border-lime-500/30 transition-all"
                            title="Editar Suministro"
                          >
                            <Edit size={16} />
                          </button>
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

      <PaginationFooter 
        currentPage={page} 
        totalItems={totalCount} 
        itemsPerPage={limit} 
        onPageChange={setPage} 
        onItemsPerPageChange={setLimit}
        itemName="suministros" 
      />

      {isEditModalOpen && selectedSupplyPoint && (
        <EditSupplyPointModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          supplyPoint={selectedSupplyPoint}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
}
