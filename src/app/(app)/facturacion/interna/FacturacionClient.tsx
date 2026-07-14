'use client';

import { useState } from 'react';
import { Calculator, CheckCircle, FileText, AlertCircle, RefreshCw, Eye, Wrench, Trash2, Download, Table } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function FacturacionClient({ pendingF1s, drafts }: { pendingF1s: any[], drafts: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'REPAIR' | 'DRAFTS'>('PENDING');
  const [selectedF1s, setSelectedF1s] = useState<string[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [selectedRepairDrafts, setSelectedRepairDrafts] = useState<string[]>([]);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validDrafts = drafts; // All drafts, since we merged the tabs
  const repairDrafts = drafts.filter(d => d.status === 'REQUIERE_REPARACION');

  const toggleSelect = (id: string, setter: any, state: string[]) => {
    setter(state.includes(id) ? state.filter(x => x !== id) : [...state, id]);
  };

  const handleCalculate = async () => {
    if (selectedF1s.length === 0) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ f1Ids: selectedF1s })
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Error al calcular facturas');
      
      setSelectedF1s([]);
      // Switch to repair tab if any repairs are needed, else drafts
      setActiveTab('REPAIR'); // We assume user wants to check if there are repairs
      router.refresh();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRepair = async () => {
    if (selectedRepairDrafts.length === 0) return;
    setIsRepairing(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: selectedRepairDrafts })
      });
      if (res.ok) {
        toast.success(`F1s bloqueados reparados e inyectados`);
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.message || 'Error al reparar');
      }
    } catch (e) {
      toast.error('Error de red');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/facturacion/interna/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: selectedRepairDrafts })
      });
      if (res.ok) {
        toast.success(`Cálculo actualizado correctamente`);
        setSelectedRepairDrafts([]);
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.message || 'Error al recalcular');
      }
    } catch (e) {
      toast.error('Error de red');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalculateSingle = async (draftId: string) => {
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/facturacion/interna/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: [draftId] })
      });
      if (res.ok) {
        toast.success(`Cálculo actualizado correctamente`);
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.message || 'Error al recalcular');
      }
    } catch (e) {
      toast.error('Error de red');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (selectedDrafts.length === 0) return;
    setIsConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: selectedDrafts })
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Error al confirmar facturas');
      
      setSelectedDrafts([]);
      router.refresh();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeleteDrafts = async (draftIds: string[], type: 'REPAIR' | 'DRAFTS') => {
    if (draftIds.length === 0) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/drafts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds })
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Error al borrar borradores');
      
      if (type === 'REPAIR') setSelectedRepairDrafts([]);
      if (type === 'DRAFTS') setSelectedDrafts([]);
      
      // We go to pending tab to see them again
      setActiveTab('PENDING');
      router.refresh();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 border-b border-[var(--border)] pb-2">
        <button 
          onClick={() => setActiveTab('PENDING')}
          className={`px-4 py-2 font-semibold text-sm rounded-t-md transition-colors ${activeTab === 'PENDING' ? 'text-[var(--lime)] border-b-2 border-[var(--lime)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          Pendientes de Cálculo ({pendingF1s.length})
        </button>
        <button 
          onClick={() => setActiveTab('DRAFTS')}
          className={`px-4 py-2 font-semibold text-sm rounded-t-md transition-colors ${activeTab === 'DRAFTS' ? 'text-[var(--lime)] border-b-2 border-[var(--lime)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          Borradores ({validDrafts.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* PENDING TAB */}
      {activeTab === 'PENDING' && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={20} className="text-[var(--lime)]" /> F1s Pendientes
            </h2>
            <button className="btn btn-primary" disabled={selectedF1s.length === 0 || isCalculating} onClick={handleCalculate}>
              {isCalculating ? <RefreshCw className="animate-spin" size={18} /> : <Calculator size={18} />}
              Generar Cálculos ({selectedF1s.length})
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" className="rounded" onChange={(e) => setSelectedF1s(e.target.checked ? pendingF1s.map(f => f.id) : [])} checked={selectedF1s.length === pendingF1s.length && pendingF1s.length > 0} /></th>
                  <th className="px-4 py-3">Nº Factura F1</th>
                  <th className="px-4 py-3">CUPS</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-center">F1 Facturado Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {pendingF1s.map((f1) => (
                  <tr key={f1.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selectedF1s.includes(f1.id)} onChange={() => toggleSelect(f1.id, setSelectedF1s, selectedF1s)} /></td>
                    <td className="px-4 py-3 font-mono">{f1.numeroFactura || 'S/N'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{f1.contract?.supplyPoint?.cups}</td>
                    <td className="px-4 py-3">{f1.contract?.client?.businessName || f1.contract?.client?.name}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {f1.invoices && f1.invoices.length > 0 ? (
                          <div className="flex items-center gap-1" title="F1 ya ha sido facturado por el proveedor">
                            <CheckCircle size={16} className="text-[var(--lime)]" />
                            {f1.invoices[0].pdfUrl && (
                              <a href={f1.invoices[0].pdfUrl} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white" title="Ver factura del proveedor">
                                <FileText size={16} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                        {f1.xmlUrl && (
                          <a href={f1.xmlUrl} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Descargar XML F1 original">
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingF1s.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-[var(--text-muted)]">No hay facturas F1 pendientes.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* DRAFTS TAB */}
      {activeTab === 'DRAFTS' && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CheckCircle size={20} className="text-[var(--lime)]" /> Borradores Generados
            </h2>
            <div className="flex gap-2">
              <button 
                className="btn border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-red-500" 
                disabled={selectedDrafts.length === 0 || isDeleting || isConfirming} 
                onClick={() => handleDeleteDrafts(selectedDrafts, 'DRAFTS')}
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                Borrar ({selectedDrafts.length})
              </button>
              <button className="btn btn-primary" disabled={selectedDrafts.length === 0 || isConfirming || isDeleting} onClick={handleConfirm}>
                {isConfirming ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Confirmar Facturas ({selectedDrafts.length})
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" className="rounded" onChange={(e) => setSelectedDrafts(e.target.checked ? validDrafts.map(d => d.id) : [])} checked={selectedDrafts.length === validDrafts.length && validDrafts.length > 0} /></th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">CUPS</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Problema Detectado</th>
                  <th className="px-4 py-3 text-right">F1 (kWh)</th>
                  <th className="px-4 py-3 text-right">CCH (kWh)</th>
                  <th className="px-4 py-3 text-right">M. Potencia (€)</th>
                  <th className="px-4 py-3 text-right">M. Energía (€)</th>
                  <th className="px-4 py-3 text-right">Total (€)</th>
                  <th className="px-4 py-3 text-right">Total Proveedor (€)</th>
                  <th className="px-4 py-3 text-center">F1 Facturado Proveedor</th>
                  <th className="px-4 py-3 text-right uppercase text-xs font-semibold tracking-wider text-[var(--text-secondary)]">Factura Interna</th>
                </tr>
              </thead>
              <tbody>
                {validDrafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selectedDrafts.includes(draft.id)} onChange={() => toggleSelect(draft.id, setSelectedDrafts, selectedDrafts)} /></td>
                    <td className="px-4 py-3 font-semibold">{draft.contract?.client?.businessName || draft.contract?.client?.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{draft.contract?.supplyPoint?.cups}</td>
                    <td className="px-4 py-3 font-medium text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {draft.f1Invoice?.fechaInicio ? new Date(draft.f1Invoice.fechaInicio).toLocaleDateString('es-ES') : ''} - {draft.f1Invoice?.fechaFin ? new Date(draft.f1Invoice.fechaFin).toLocaleDateString('es-ES') : ''}
                    </td>
                    <td className="px-4 py-3">
                      {draft.status === 'REQUIERE_REPARACION' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-orange-500 font-bold text-xs flex items-center gap-1"><AlertCircle size={12}/> PROBLEMA DETECTADO</span>
                          <span className="text-[var(--text-primary)] text-xs font-medium leading-tight">{(draft.repairData as any)?.issue || 'Error de cálculo'}</span>
                        </div>
                      ) : (draft.invoiceData as any)?.repaired ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-orange-400 font-bold text-xs flex items-center gap-1"><AlertCircle size={12}/> AUTO-AJUSTADO</span>
                          <span className="text-[var(--text-primary)] text-xs font-medium leading-tight">{(draft.repairData as any)?.issue}</span>
                        </div>
                      ) : (
                        <span className="text-[var(--lime)] font-medium text-xs flex items-center gap-1"><CheckCircle size={12}/> Sin descuadre</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(draft.invoiceData as any)?.repaired 
                        ? (((draft.repairData as any)?.f1Volume * 1000)?.toFixed(2) || '0.00')
                        : (draft.totalMWh * 1000).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                      {(draft.invoiceData as any)?.repaired 
                        ? (((draft.repairData as any)?.cchVolume * 1000)?.toFixed(2) || '0.00')
                        : (draft.totalMWh * 1000).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--lime)]">
                      {(draft.invoiceData as any)?.powerMargin !== undefined ? `${(draft.invoiceData as any).powerMargin.toFixed(2)} €` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--lime)]">
                      {(draft.invoiceData as any)?.energyMargin !== undefined ? `${(draft.invoiceData as any).energyMargin.toFixed(2)} €` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--lime)]">{draft.totalAmount?.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-right font-bold text-[#FFD700]">
                      {draft.f1Invoice?.invoices && draft.f1Invoice.invoices.length > 0 && draft.f1Invoice.invoices[0].totalAmount !== undefined && draft.f1Invoice.invoices[0].totalAmount !== null
                        ? `${draft.f1Invoice.invoices[0].totalAmount.toFixed(2)} €`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {draft.f1Invoice?.invoices && draft.f1Invoice.invoices.length > 0 ? (
                          <div className="flex items-center gap-1" title="F1 ya ha sido facturado por el proveedor">
                            <CheckCircle size={16} className="text-[var(--lime)]" />
                            {draft.f1Invoice.invoices[0].pdfUrl && (
                              <a href={draft.f1Invoice.invoices[0].pdfUrl} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white" title="Ver factura del proveedor">
                                <FileText size={16} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                        {draft.f1Invoice?.xmlUrl && (
                          <a href={draft.f1Invoice.xmlUrl} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Descargar XML F1 original">
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleRecalculateSingle(draft.id)} className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Forzar Recálculo">
                          <RefreshCw size={16} />
                        </button>
                        <a href={`/api/facturacion/interna/export-excel/${draft.id}`} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-[#217346] inline-flex items-center" title="Descargar Desglose Excel">
                          <Table size={16} />
                        </a>
                        <a href={`/api/facturacion/interna/proforma/${draft.id}`} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Descargar PDF Proforma">
                          <FileText size={16} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {validDrafts.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-[var(--text-muted)]">No hay borradores listos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
