'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import Link from 'next/link';
import { 
  Zap, ArrowLeft, Edit, MapPin, Activity, CreditCard, 
  History, FileText, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import EditSupplyPointModal from '../EditSupplyPointModal';

export default function SupplyPointDetailClient({ 
  initialSupplyPoint, 
  userRole 
}: { 
  initialSupplyPoint: any,
  userRole: string 
}) {
  const [supplyPoint, setSupplyPoint] = useState(initialSupplyPoint);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch(status?.toUpperCase()) {
      case 'ACTIVO': return 'text-lime-400 bg-lime-400/10 border-lime-400/20';
      case 'RECHAZADO': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'EN TRAMITE': 
      case 'TRAMITE': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'BAJA': return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  const latestContract = supplyPoint.contracts?.[0];
  const currentStatus = latestContract?.status || 'SIN CONTRATO';

  return (
    <div className="flex-1 bg-black/40 h-[100vh] overflow-y-auto w-full relative">
      <Topbar title="Detalle Punto de Suministro" showSearch={false} />

      <div className="p-8 pb-32 max-w-[1600px] mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/5 p-6 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link 
              href="/puntos-suministro" 
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
            >
              <ArrowLeft className="text-white/60" size={20} />
            </Link>
            <div className="bg-lime-500/10 p-3 rounded-xl border border-lime-500/20">
              <Zap className="text-lime-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                {supplyPoint.cups}
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getStatusColor(currentStatus)}`}>
                  {currentStatus}
                </span>
              </h1>
              <p className="text-sm text-white/50 mt-1">
                Cliente: <Link href={`/clientes/${supplyPoint.client.id}`} className="text-white hover:text-lime-400 underline decoration-white/20 underline-offset-4">{supplyPoint.client.businessName}</Link>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {['BACKOFFICE', 'COMPANYADMIN', 'SUPERADMIN'].includes(userRole) && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Edit size={16} />
                <span>Editar Datos</span>
              </button>
            )}
          </div>
        </div>

        {/* Grid de Datos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card: Dirección */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <MapPin size={18} className="text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Dirección de Suministro</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">Dirección Completa</p>
                <p className="text-sm text-white">{supplyPoint.address || 'No definida'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">Población</p>
                  <p className="text-sm text-white">{supplyPoint.city || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">C.P.</p>
                  <p className="text-sm text-white">{supplyPoint.postalCode || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">Provincia</p>
                  <p className="text-sm text-white">{supplyPoint.province || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Datos Técnicos */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-lime-500/10 rounded-lg border border-lime-500/20">
                <Activity size={18} className="text-lime-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Datos Técnicos</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">Tarifa</p>
                <p className="text-sm text-white">{supplyPoint.tariff || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">Consumo Anual</p>
                <p className="text-sm text-white">{supplyPoint.annualConsumption ? `${supplyPoint.annualConsumption} kWh` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">CNAE</p>
                <p className="text-sm text-white">{supplyPoint.cnae || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">Distribuidora</p>
                <p className="text-sm text-white truncate" title={supplyPoint.distributor}>{supplyPoint.distributor || '-'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-white/40 font-semibold mb-2 uppercase tracking-wider">Potencias (kW)</p>
              <div className="grid grid-cols-3 gap-2">
                {['p1c', 'p2c', 'p3c', 'p4c', 'p5c', 'p6c'].map((p, i) => (
                  supplyPoint[p] ? (
                    <div key={p} className="bg-white/5 border border-white/5 rounded flex items-center justify-between px-2 py-1">
                      <span className="text-[10px] text-white/40 font-mono">P{i+1}</span>
                      <span className="text-xs text-white">{supplyPoint[p]}</span>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          </div>

          {/* Card: Datos Bancarios */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <CreditCard size={18} className="text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Datos Bancarios</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">IBAN</p>
                <p className="text-sm text-white font-mono">{supplyPoint.iban || 'No definido'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 font-semibold mb-1 uppercase tracking-wider">SWIFT/BIC</p>
                <p className="text-sm text-white font-mono">{supplyPoint.swift || '-'}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Datos SIPS */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm mt-8">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Activity size={18} className="text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Datos SIPS</h2>
            </div>
            
            <button
              onClick={async () => {
                const toast = (await import('react-hot-toast')).default;
                const { updateSupplyPointSipsAction } = await import('@/app/actions/supplyPointActions');
                const loadingToast = toast.loading('Actualizando SIPS desde INGEBAU...');
                try {
                  const res = await updateSupplyPointSipsAction(supplyPoint.id);
                  if (res.success) {
                    toast.success('Datos SIPS actualizados correctamente', { id: loadingToast });
                    setSupplyPoint((prev: any) => ({ ...prev, sipsRawData: res.sipsData }));
                  } else {
                    toast.error(res.error || 'Error al actualizar SIPS', { id: loadingToast });
                  }
                } catch (e: any) {
                  toast.error('Error al actualizar SIPS', { id: loadingToast });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-medium transition-colors"
            >
              <Clock size={16} />
              <span>Actualizar SIPS</span>
            </button>
          </div>
          
          <div className="p-6">
            {supplyPoint.sipsRawData ? (
              (() => {
                const raw: any = supplyPoint.sipsRawData;
                let psData: any = null;
                if (raw.data && raw.data.ps && raw.data.ps.length > 0) psData = raw.data.ps[0];
                else if (raw.ps && raw.ps.length > 0) psData = raw.ps[0];
                else if (raw.CUPS || raw.CNAE) psData = raw;

                if (!psData) {
                  return (
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-x-auto">
                      <pre className="text-xs text-lime-400 font-mono">
                        {JSON.stringify(supplyPoint.sipsRawData, null, 2)}
                      </pre>
                    </div>
                  );
                }

                // Agrupar potencias y consumos (P1 a P6)
                const periodos = [1, 2, 3, 4, 5, 6];
                
                // Resto de datos filtrados
                const powerKeys = periodos.flatMap(p => [`ConsumoAnualP${p}kWh`, `PotenciaContratadaP${p}kW`]);
                const generalData = Object.entries(psData).filter(([key, value]) => 
                  typeof value !== 'object' && !powerKeys.includes(key)
                );

                return (
                  <div className="space-y-6">
                    {/* Tabla de Potencias y Consumos */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-sm font-semibold text-white">Potencias y Consumos por Período</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="bg-black/40 border-b border-white/5">
                              <th className="p-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Métrica</th>
                              {periodos.map(p => (
                                <th key={`th-${p}`} className="p-3 text-xs font-semibold text-white/40 uppercase tracking-wider text-center">P{p}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Fila Potencia */}
                            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-sm text-white/70 font-medium">Potencia Contratada (kW)</td>
                              {periodos.map(p => (
                                <td key={`pot-${p}`} className="p-3 text-sm text-white font-medium text-center">
                                  {psData[`PotenciaContratadaP${p}kW`] || '-'}
                                </td>
                              ))}
                            </tr>
                            {/* Fila Consumo */}
                            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-sm text-white/70 font-medium">Consumo Anual (kWh)</td>
                              {periodos.map(p => (
                                <td key={`cons-${p}`} className="p-3 text-sm text-white font-medium text-center">
                                  {psData[`ConsumoAnualP${p}kWh`] || '-'}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Resto de Datos SIPS */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-sm font-semibold text-white">Otros Datos SIPS</h3>
                      </div>
                      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {generalData.map(([key, value]) => (
                          <div key={key} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 hover:bg-white/[0.04] transition-colors">
                            <p className="text-[10px] text-white/40 font-semibold mb-1 uppercase tracking-wider truncate" title={key}>{key}</p>
                            <p className="text-sm text-white font-medium truncate" title={String(value)}>{String(value) || '-'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8 text-white/40">
                <Activity size={32} className="mx-auto mb-3 opacity-20" />
                <p>No hay datos SIPS descargados para este punto de suministro.</p>
                <p className="text-sm mt-1">Haz clic en Actualizar SIPS para consultarlos en tiempo real.</p>
              </div>
            )}
          </div>
        </div>

        {/* Histórico de Contratos */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm mt-8">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <History size={18} className="text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Histórico de Contratos</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/5">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Código</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Fecha Registro</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Comercial</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Producto</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {!supplyPoint.contracts || supplyPoint.contracts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/50">
                      No hay contratos asociados a este punto de suministro
                    </td>
                  </tr>
                ) : (
                  supplyPoint.contracts.map((contract: any) => (
                    <tr key={contract.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 font-mono text-sm text-white">
                        <Link href={`/contratos/${contract.id}`} className="hover:text-lime-400 transition-colors">
                          {contract.contractCode || contract.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="p-4 text-sm text-white/70">
                        {formatDate(contract.createdAt)}
                      </td>
                      <td className="p-4 text-sm text-white/70">
                        {contract.user?.name || contract.user?.email || '-'}
                      </td>
                      <td className="p-4 text-sm text-white/70 font-medium">
                        {contract.product?.name || 'Desconocido'}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(contract.status)}`}>
                          {contract.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {contract.pdfUrl || contract.airtableData?.['Contrato PDF'] ? (
                          <a 
                            href={contract.pdfUrl || contract.airtableData?.['Contrato PDF']} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            title="Ver Contrato PDF"
                          >
                            <FileText size={16} />
                          </a>
                        ) : (
                          <span className="text-white/20 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <EditSupplyPointModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        supplyPoint={supplyPoint}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
