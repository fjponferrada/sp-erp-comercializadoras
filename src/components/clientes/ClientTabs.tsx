'use client';

import React, { useState } from 'react';
import { Download, FileText, Activity, Zap, CreditCard, RefreshCw, AlertTriangle } from 'lucide-react';
import RenewContractModal from './RenewContractModal';
import PenalizationModal from './PenalizationModal';
import RequestPaymentButton from '@/components/facturas/RequestPaymentButton';

export default function ClientTabs({ client, supplyPoints, contracts, invoices }: any) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [contractToRenew, setContractToRenew] = useState<any>(null);
  const [contractToPenalize, setContractToPenalize] = useState<any>(null);

  const totalFacturacion = invoices.reduce((acc: number, curr: any) => acc + curr.totalAmount, 0);
  const activeContractsCount = contracts.filter((c: any) => c.status === 'ACTIVO').length;
  const totalMWh = invoices.reduce((acc: number, curr: any) => acc + curr.totalMWh, 0);

  return (
    <div className="space-y-6 mt-8">
      {/* NAVEGACIÓN TABS */}
      <div className="flex space-x-1 border-b border-slate-700/50">
        <button 
          onClick={() => setActiveTab('resumen')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'resumen' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
        >
          Visión General
        </button>
        <button 
          onClick={() => setActiveTab('supplyPoints')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'supplyPoints' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
        >
          Puntos de Suministro <span className="bg-slate-800 text-slate-300 py-0.5 px-2 rounded-full text-xs">{supplyPoints.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('contracts')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'contracts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
        >
          Contratos <span className="bg-slate-800 text-slate-300 py-0.5 px-2 rounded-full text-xs">{contracts.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'invoices' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
        >
          Facturación <span className="bg-slate-800 text-slate-300 py-0.5 px-2 rounded-full text-xs">{invoices.length}</span>
        </button>
      </div>

      {/* CONTENIDO TABS */}
      <div className="pt-4">
        {/* RESUMEN */}
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-slate-400">Facturación Histórica</p>
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-3xl font-bold text-white">
                  {totalFacturacion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </h3>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-slate-400">Energía Consumida</p>
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-3xl font-bold text-white">
                  {totalMWh.toLocaleString('es-ES', { maximumFractionDigits: 1 })} MWh
                </h3>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-slate-400">Contratos Activos</p>
                  <Activity className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-3xl font-bold text-white">
                  {activeContractsCount}
                </h3>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6">
              <h4 className="text-lg font-semibold text-white mb-4">Datos Bancarios</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">IBAN</p>
                  <p className="text-slate-200 font-mono">{client.iban || 'No registrado'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Forma de Pago</p>
                  <p className="text-slate-200">{client.paymentMethod || 'No especificada'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FACTURAS */}
        {activeTab === 'invoices' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Nº Factura</th>
                  <th className="px-6 py-4">Fecha Emisión</th>
                  <th className="px-6 py-4">CUPS Asignado</th>
                  <th className="px-6 py-4 text-right">Total €</th>
                  <th className="px-6 py-4">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4">{new Date(inv.issueDate).toLocaleDateString('es-ES')}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{inv.supplyPoint?.cups || '-'}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-400">
                      {inv.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-6 py-4">
                      {inv.pdfUrl ? (
                        <div className="flex items-center gap-4">
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs">
                            <Download size={14} /> Descargar
                          </a>
                          <RequestPaymentButton invoiceId={inv.id} type="transfer" />
                          <RequestPaymentButton invoiceId={inv.id} type="overdue" />
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Sin PDF</span>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Este cliente aún no tiene facturas emitidas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PUNTOS DE SUMINISTRO */}
        {activeTab === 'supplyPoints' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">CUPS</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Tarifa</th>
                  <th className="px-6 py-4">Autoconsumo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {supplyPoints.map((sp: any) => (
                  <tr key={sp.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-white">{sp.cups}</td>
                    <td className="px-6 py-4">{sp.address}, {sp.city}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded text-xs">{sp.tariff}</span>
                    </td>
                    <td className="px-6 py-4">
                      {sp.hasSelfConsumption ? (
                        <span className="text-emerald-400 flex items-center gap-1"><Zap size={14} /> Sí</span>
                      ) : <span className="text-slate-500">No</span>}
                    </td>
                  </tr>
                ))}
                {supplyPoints.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No hay puntos de suministro registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTRATOS */}
        {activeTab === 'contracts' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha Activación</th>
                  <th className="px-6 py-4">Comisión Final</th>
                  <th className="px-6 py-4">Documentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {contracts.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        c.status === 'ACTIVO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        c.status === 'BAJA' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">{c.activationDate ? new Date(c.activationDate).toLocaleDateString('es-ES') : 'Pendiente'}</td>
                    <td className="px-6 py-4 text-emerald-400 font-medium">
                      {c.commissionFinal ? c.commissionFinal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 transition-colors">
                          <FileText size={14} /> Ver Doc
                        </button>
                        {(c.status === 'ACTIVO' || c.status === 'RENOVACION_TRAMITADA') && (
                          <button 
                            onClick={() => setContractToRenew(c)}
                            className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 transition-colors bg-emerald-500/10 px-2 py-1 rounded"
                          >
                            <RefreshCw size={12} /> Renovar / Modificar
                          </button>
                        )}
                        {c.status === 'BAJA' && (
                          <button 
                            onClick={() => setContractToPenalize(c)}
                            className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 transition-colors bg-rose-500/10 px-2 py-1 rounded"
                          >
                            <AlertTriangle size={12} /> Penalizar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No hay contratos para este cliente.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {contractToRenew && (
        <RenewContractModal 
          contract={contractToRenew} 
          onClose={() => setContractToRenew(null)} 
        />
      )}

      {contractToPenalize && (
        <PenalizationModal 
          contract={contractToPenalize} 
          onClose={() => setContractToPenalize(null)} 
        />
      )}
    </div>
  );
}
