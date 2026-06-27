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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Puntos de Suministro" 
        subtitle="Gestión de CUPS y consumos"
        showSearch={false} 
      />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Search */}
        <div
          className="animate-fade-in-up delay-300"
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              placeholder="Buscar por CUPS, Dirección o Titular..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalCount}</span> suministros encontrados
          </div>
        </div>

        {/* Table */}
        <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>
          
          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {loading && supplyPoints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando puntos de suministro...</div>
            ) : supplyPoints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron resultados</div>
            ) : (
                supplyPoints.map((sp) => (
                    <div key={sp.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                    <Zap size={14} color="var(--lime)" />
                                </div>
                                <div>
                                    <Link href={`/puntos-suministro/${sp.id}`} style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', textDecoration: 'none' }}>
                                        {sp.cups}
                                    </Link>
                                </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                {sp.tariff || 'S/D'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Building2 size={12} color="var(--text-muted)" />
                                <Link href={`/clientes/${sp.clientId}`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>
                                    {sp.client?.businessName || 'Desconocido'}
                                </Link>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                <MapPin size={12} color="var(--text-muted)" style={{ marginTop: '3px', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{sp.address}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sp.postalCode} - {sp.city} ({sp.province})</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {sp.annualConsumption ? `${sp.annualConsumption} kWh` : '-'}
                            </div>

                            {sp.contracts && sp.contracts.length > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
                                        <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: 'var(--lime)', opacity: 0.75 }}></span>
                                        <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', backgroundColor: 'var(--lime)' }}></span>
                                    </span>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--lime)' }}>Activo</span>
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>Sin Contrato</span>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <Link href={`/puntos-suministro/${sp.id}`} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                                <Eye size={12} /> Ver Detalle
                            </Link>
                            {['BACKOFFICE', 'COMPANYADMIN', 'SUPERADMIN'].includes(userRole) && (
                                <button onClick={() => handleEdit(sp)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Edit size={12} /> Editar
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CUPS / Tarifa</th>
                  <th>Titular</th>
                  <th>Dirección</th>
                  <th>Consumo</th>
                  <th>Estado Contrato</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && supplyPoints.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando puntos de suministro...</td>
                  </tr>
                ) : supplyPoints.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron resultados</td>
                  </tr>
                ) : (
                  supplyPoints.map((sp) => (
                    <tr key={sp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <Zap size={14} color="var(--lime)" />
                          </div>
                          <div>
                            <Link href={`/puntos-suministro/${sp.id}`} style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', textDecoration: 'none' }}>
                              {sp.cups}
                            </Link>
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '12px', border: '1px solid var(--border)', marginLeft: '6px' }}>
                              {sp.tariff || 'S/D'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={14} color="var(--text-muted)" />
                          <Link href={`/clientes/${sp.clientId}`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>
                            {sp.client?.businessName || 'Desconocido'}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px', marginLeft: '20px' }}>{sp.client?.vatNumber}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <MapPin size={14} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sp.address}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sp.postalCode} - {sp.city} ({sp.province})</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {sp.annualConsumption ? `${sp.annualConsumption} kWh` : '-'}
                      </td>
                      <td>
                        {sp.contracts && sp.contracts.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
                              <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: 'var(--lime)', opacity: 0.75 }}></span>
                              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', backgroundColor: 'var(--lime)' }}></span>
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--lime)', background: 'rgba(222,255,154,0.1)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(222,255,154,0.2)' }}>
                              Activo
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>Sin Contrato Activo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <Link
                            href={`/puntos-suministro/${sp.id}`}
                            className="action-icon"
                            title="Ver Detalle"
                          >
                            <Eye size={16} />
                          </Link>
                          {['BACKOFFICE', 'COMPANYADMIN', 'SUPERADMIN'].includes(userRole) && (
                            <button
                              onClick={() => handleEdit(sp)}
                              className="action-icon"
                              title="Editar Suministro"
                            >
                              <Edit size={16} />
                            </button>
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
