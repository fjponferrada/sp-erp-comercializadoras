'use client';

import { useState, useEffect, useTransition } from 'react';
import { Calculator, CheckCircle, FileText, AlertCircle, RefreshCw, Eye, EyeOff, Wrench, Trash2, Download, Table } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function FacturacionClient({ pendingF1s, drafts, historicalInvoices = [] }: { pendingF1s: any[], drafts: any[], historicalInvoices?: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'REPAIR' | 'DRAFTS'>('PENDING');
  const [filterVisibility, setFilterVisibility] = useState<'VISIBLE' | 'HIDDEN'>('VISIBLE');
  const [selectedF1s, setSelectedF1s] = useState<string[]>([]);
  const searchParamsUrl = useSearchParams();
  const initialSearch = searchParamsUrl.get('q') || '';
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [selectedRepairDrafts, setSelectedRepairDrafts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const currentQ = searchParamsUrl.get('q') || '';
      if (currentQ === searchTerm) return; // Evitar pushes redundantes y bucles infinitos

      const params = new URLSearchParams(searchParamsUrl.toString());
      if (searchTerm) {
        params.set('q', searchTerm);
      } else {
        params.delete('q');
      }
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]); // Solo dependemos del searchTerm para evitar re-triggers
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validDrafts = drafts.filter(d => filterVisibility === 'HIDDEN' ? d.hidden : !d.hidden); // Filter by visibility

  const repairDrafts = drafts.filter(d => d.status === 'REQUIERE_REPARACION');

  // We no longer filter client-side since the server gives us the filtered results
  const filteredPendingF1s = pendingF1s;

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

  const handleToggleHidden = async (draftId: string, currentHidden: boolean) => {
    try {
      const res = await fetch('/api/facturacion/interna/toggle-hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, hidden: !currentHidden })
      });
      if (res.ok) {
        toast.success(currentHidden ? 'Borrador visible' : 'Borrador oculto');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Error al cambiar visibilidad');
      }
    } catch (e) {
      toast.error('Error de red');
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
            <div className="flex gap-4 items-center">
              <div className="relative flex items-center">
                <input 
                  type="text"
                  placeholder="Buscar por CUPS, Nº Factura o Cliente..."
                  className="input text-sm w-80 pr-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isPending && <RefreshCw className="animate-spin absolute right-3 text-[var(--text-secondary)]" size={16} />}
              </div>
              <button className="btn btn-primary whitespace-nowrap" disabled={selectedF1s.length === 0 || isCalculating} onClick={handleCalculate}>
                {isCalculating ? <RefreshCw className="animate-spin" size={18} /> : <Calculator size={18} />}
                Generar Cálculos ({selectedF1s.length})
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" className="rounded" onChange={(e) => setSelectedF1s(e.target.checked ? filteredPendingF1s.map(f => f.id) : [])} checked={selectedF1s.length === filteredPendingF1s.length && filteredPendingF1s.length > 0} /></th>
                  <th className="px-4 py-3">Nº Factura F1</th>
                  <th className="px-4 py-3">CUPS</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-center">F1 Facturado Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingF1s.map((f1) => (
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
                {filteredPendingF1s.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-[var(--text-muted)]">No se encontraron facturas F1 pendientes.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* DRAFTS TAB */}
      {activeTab === 'DRAFTS' && (
        <div className="flex flex-col gap-6">
          {drafts.length > 0 && (
            <div className="card flex justify-between items-center py-4">
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
                <div className="flex bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md overflow-hidden">
                  <button 
                    className={`px-3 py-1 text-sm font-medium transition-colors ${filterVisibility === 'VISIBLE' ? 'bg-[var(--lime)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setFilterVisibility('VISIBLE')}
                  >
                    Visibles
                  </button>
                  <button 
                    className={`px-3 py-1 text-sm font-medium transition-colors ${filterVisibility === 'HIDDEN' ? 'bg-[var(--lime)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setFilterVisibility('HIDDEN')}
                  >
                    Ocultos
                  </button>
                </div>
                <button className="btn btn-primary" disabled={selectedDrafts.length === 0 || isConfirming || isDeleting} onClick={handleConfirm}>
                  {isConfirming ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  Confirmar Facturas ({selectedDrafts.length})
                </button>
              </div>
            </div>
          )}

          {[
            { type: 'N', title: 'Normales (N)' },
            { type: 'R', title: 'Rectificadoras (R)' },
            { type: 'A', title: 'Anuladoras (A)' },
            { type: 'C', title: 'Complementarias (C)' },
            { type: 'G', title: 'Regularizadoras (G)' }
          ].map(({ type, title }) => {
            const sectionDrafts = validDrafts.filter(d => {
              let tipo = 'N';
              const f1 = d.f1Invoice;
              if (f1 && f1.jsonData) {
                // El XML completo no se guarda, se guarda el tag <FacturaATR> 
                // Su estructura es f1.jsonData.DatosGeneralesFacturaATR.DatosGeneralesFactura
                const datosGen = f1.jsonData.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                              || f1.jsonData.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
                              || f1.jsonData.DatosGeneralesFactura;

                if (datosGen) {
                  if (datosGen.TipoFactura) {
                    tipo = typeof datosGen.TipoFactura === 'string' ? datosGen.TipoFactura : (Array.isArray(datosGen.TipoFactura) ? datosGen.TipoFactura[0] : 'N');
                  }
                }
              }
              (d as any)._tipo = tipo;
              
              if (tipo === 'N') {
                // Check if this N invoice overlaps with an already confirmed invoice for the same supply point
                const isDuplicate = historicalInvoices.some(hi => 
                  hi.contract.supplyPointId === d.contract?.supplyPointId &&
                  hi.billingStart && hi.billingEnd && d.billingStart && d.billingEnd &&
                  new Date(hi.billingStart).getTime() === new Date(d.billingStart).getTime() &&
                  new Date(hi.billingEnd).getTime() === new Date(d.billingEnd).getTime()
                );
                (d as any)._isDuplicateCycle = isDuplicate;
                
                // Check if there's an A draft for the same period
                const hasA = validDrafts.some(vd => 
                  ((vd as any)._tipo === 'A') &&
                  vd.contract?.supplyPointId === d.contract?.supplyPointId &&
                  vd.billingStart && vd.billingEnd && d.billingStart && d.billingEnd &&
                  new Date(vd.billingStart).getTime() === new Date(d.billingStart).getTime() &&
                  new Date(vd.billingEnd).getTime() === new Date(d.billingEnd).getTime()
                );
                (d as any)._hasParentA = hasA;
              }
              
              if (type === 'R') {
                if (tipo === 'R') return true;
                if (tipo === 'S' || tipo === 'AR') {
                  const hasParentR = validDrafts.some(vd => {
                    if ((vd as any)._tipo !== 'R') return false;
                    const dGen = vd.f1Invoice?.jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                               || vd.f1Invoice?.jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
                               || vd.f1Invoice?.jsonData?.DatosGeneralesFactura;
                    const cOrig = dGen?.CodigoFacturaRectificadaAnulada;
                    const cAbo = dGen?.CodigoFacturaAbono || (cOrig ? `AR-${cOrig}` : undefined);
                    return cAbo === d.f1Invoice?.numeroFactura;
                  });
                  return !hasParentR;
                }
                return false;
              }
              
              if (type === 'A') {
                if (tipo === 'A') return true;
                if (tipo === 'N' && ((d as any)._isDuplicateCycle || (d as any)._hasParentA)) {
                  // If it's an orphan duplicate N, or an N with a parent A, it belongs in the A section
                  const hasParentA = (d as any)._hasParentA;
                  return !hasParentA; // If it has a parent A, it will be rendered INSIDE the A row's logic, so we don't want it as a top-level row here unless it's orphaned
                }
                return false;
              }
              
              if (type === 'N') {
                return tipo === 'N' && !(d as any)._isDuplicateCycle && !(d as any)._hasParentA;
              }
              
              return tipo === type;
            });
            if (sectionDrafts.length === 0) return null;

            return (
              <div key={type} className="card">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-md font-bold text-[var(--text-primary)] flex items-center gap-2">
                    {title} ({sectionDrafts.length})
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            className="rounded" 
                            onChange={(e) => {
                              const sectionIds = sectionDrafts.flatMap(d => {
                                const ids = [d.id];
                                if (type === 'R') {
                                  const datosGen = d.f1Invoice?.jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                                                || d.f1Invoice?.jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
                                                || d.f1Invoice?.jsonData?.DatosGeneralesFactura;
                                  const isOrphanAR = ((d as any)._tipo === 'AR' || (d as any)._tipo === 'S');
                                  if (isOrphanAR) return ids; // Already included as d.id
                                  
                                  const codOriginal = datosGen?.CodigoFacturaRectificadaAnulada;
                                  const codAbono = datosGen?.CodigoFacturaAbono || (codOriginal ? `AR-${codOriginal}` : undefined);
                                  if (codAbono) {
                                    const arDraft = validDrafts.find(vd => ((vd as any)._tipo === 'AR' || (vd as any)._tipo === 'S') && vd.f1Invoice?.numeroFactura === String(codAbono));
                                    if (arDraft) ids.push(arDraft.id);
                                  }
                                }
                                return ids;
                              });
                              if (e.target.checked) {
                                setSelectedDrafts(prev => Array.from(new Set([...prev, ...sectionIds])));
                              } else {
                                setSelectedDrafts(prev => prev.filter(id => !sectionIds.includes(id)));
                              }
                            }} 
                            checked={sectionDrafts.length > 0 && sectionDrafts.flatMap(d => {
                              const ids = [d.id];
                              if (type === 'R') {
                                const datosGen = d.f1Invoice?.jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                                              || d.f1Invoice?.jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
                                              || d.f1Invoice?.jsonData?.DatosGeneralesFactura;
                                const isOrphanAR = ((d as any)._tipo === 'AR' || (d as any)._tipo === 'S');
                                if (isOrphanAR) return ids; // Already included as d.id
                                
                                const codOriginal = datosGen?.CodigoFacturaRectificadaAnulada;
                                const codAbono = datosGen?.CodigoFacturaAbono || (codOriginal ? `AR-${codOriginal}` : undefined);
                                if (codAbono) {
                                  const arDraft = validDrafts.find(vd => ((vd as any)._tipo === 'AR' || (vd as any)._tipo === 'S') && vd.f1Invoice?.numeroFactura === String(codAbono));
                                  if (arDraft) ids.push(arDraft.id);
                                }
                              }
                              return ids;
                            }).every(id => selectedDrafts.includes(id))} 
                          />
                        </th>
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
                {sectionDrafts.flatMap((draft) => {
                  const rows = [];
                  const isR = type === 'R';
                  const isA = type === 'A';
                  const isOrphanAR = ((draft as any)._tipo === 'AR' || (draft as any)._tipo === 'S');
                  const isOrphanDuplicateN = type === 'A' && (draft as any)._tipo === 'N';
                  
                  let missingAR = false;
                  let arDraft: any = null;
                  
                  let missingA = false;
                  let nDraft: any = null;

                  if (isR && !isOrphanAR) {
                    const datosGen = draft.f1Invoice?.jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura 
                                  || draft.f1Invoice?.jsonData?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura
                                  || draft.f1Invoice?.jsonData?.DatosGeneralesFactura;
                    const codOriginal = datosGen?.CodigoFacturaRectificadaAnulada;
                    const codAbono = datosGen?.CodigoFacturaAbono || (codOriginal ? `AR-${codOriginal}` : undefined);
                    if (codAbono) {
                      arDraft = validDrafts.find(d => ((d as any)._tipo === 'AR' || (d as any)._tipo === 'S') && d.f1Invoice?.numeroFactura === String(codAbono));
                      if (!arDraft) missingAR = true;
                    }
                  }
                  
                  if (isA && !isOrphanDuplicateN) {
                    nDraft = validDrafts.find(d => 
                      ((d as any)._tipo === 'N') &&
                      d.contract?.supplyPointId === draft.contract?.supplyPointId &&
                      d.billingStart && d.billingEnd && draft.billingStart && draft.billingEnd &&
                      new Date(d.billingStart).getTime() === new Date(draft.billingStart).getTime() &&
                      new Date(d.billingEnd).getTime() === new Date(draft.billingEnd).getTime()
                    );
                  }

                  const renderRow = (rowDraft: any, isAR: boolean, isGroupedN: boolean, hasGroup: boolean) => {
                    let trClass = `border-b border-[var(--border)] ${isAR ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-[var(--bg-elevated)]'}`;
                    
                    if (hasGroup) {
                      if (!isAR && !isGroupedN) {
                        trClass = `border-t-2 border-l-2 border-r-2 border-b-0 border-orange-500/60 hover:bg-[var(--bg-elevated)]`;
                      } else {
                        trClass = `border-b-2 border-l-2 border-r-2 border-orange-500/60 ${isAR ? 'bg-red-500/5 hover:bg-red-500/10' : 'bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)]'}`;
                      }
                    }

                    return (
                    <tr key={rowDraft.id} className={trClass}>
                      <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selectedDrafts.includes(rowDraft.id)} onChange={() => toggleSelect(rowDraft.id, setSelectedDrafts, selectedDrafts)} /></td>
                      <td className="px-4 py-3 font-semibold">
                        {isAR && <span className="text-red-400 mr-2 font-bold" title="Abono Fantasma Automático">↳ AR</span>}
                        {isGroupedN && <span className="text-[var(--primary)] mr-2 font-bold" title="Nueva Factura Normal">↳ N</span>}
                        {isOrphanDuplicateN && <span className="text-[var(--primary)] mr-2 font-bold" title="Nueva Factura Normal">N</span>}
                        {rowDraft.contract?.client?.businessName || rowDraft.contract?.client?.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{rowDraft.contract?.supplyPoint?.cups}</td>
                      <td className="px-4 py-3 font-medium text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {rowDraft.f1Invoice?.fechaInicio ? new Date(rowDraft.f1Invoice.fechaInicio).toLocaleDateString('es-ES') : ''} - {rowDraft.f1Invoice?.fechaFin ? new Date(rowDraft.f1Invoice.fechaFin).toLocaleDateString('es-ES') : ''}
                      </td>
                      <td className="px-4 py-3">
                        {!isAR && missingAR && (
                          <div className="flex flex-col gap-1 mb-1">
                            <span className="text-red-500 font-bold text-xs flex items-center gap-1" title="No se encontró el F1 original en la base de datos, por tanto no se generó F1 de Abono automático."><AlertCircle size={12}/> F1 ABONO NO ENCONTRADO</span>
                          </div>
                        )}
                        {isOrphanDuplicateN && (
                          <div className="flex flex-col gap-1 mb-1">
                            <span className="text-orange-500 font-bold text-xs flex items-center gap-1" title="Este periodo ya fue facturado. Se requiere un F1 tipo A para poder procesar este F1."><AlertCircle size={12}/> BLOQUEADA: CICLO YA FACTURADO (ESPERANDO A)</span>
                          </div>
                        )}
                        {rowDraft.status === 'REQUIERE_REPARACION' ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-orange-500 font-bold text-xs flex items-center gap-1"><AlertCircle size={12}/> PROBLEMA DETECTADO</span>
                            <span className="text-[var(--text-primary)] text-xs font-medium leading-tight">{(rowDraft.repairData as any)?.issue || 'Error de cálculo'}</span>
                          </div>
                        ) : (rowDraft.invoiceData as any)?.repaired ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-orange-400 font-bold text-xs flex items-center gap-1"><AlertCircle size={12}/> AUTO-AJUSTADO</span>
                            <span className="text-[var(--text-primary)] text-xs font-medium leading-tight">{(rowDraft.repairData as any)?.issue}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--lime)] font-medium text-xs flex items-center gap-1"><CheckCircle size={12}/> Sin descuadre</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {(rowDraft.invoiceData as any)?.repaired 
                          ? (((rowDraft.repairData as any)?.f1Volume * 1000)?.toFixed(2) || '0.00')
                          : (rowDraft.totalMWh * 1000).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                        {(rowDraft.invoiceData as any)?.repaired 
                          ? (((rowDraft.repairData as any)?.cchVolume * 1000)?.toFixed(2) || '0.00')
                          : (rowDraft.totalMWh * 1000).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--lime)]">
                        {(rowDraft.invoiceData as any)?.powerMargin !== undefined ? `${(rowDraft.invoiceData as any).powerMargin.toFixed(2)} €` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--lime)]">
                        {(rowDraft.invoiceData as any)?.energyMargin !== undefined ? `${(rowDraft.invoiceData as any).energyMargin.toFixed(2)} €` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--lime)]">{rowDraft.totalAmount?.toFixed(2)} €</td>
                      <td className="px-4 py-3 text-right font-bold text-[#FFD700]">
                        {rowDraft.f1Invoice?.invoices && rowDraft.f1Invoice.invoices.length > 0 && rowDraft.f1Invoice.invoices[0].totalAmount !== undefined && rowDraft.f1Invoice.invoices[0].totalAmount !== null
                          ? `${(rowDraft.f1Invoice.invoices[0].invoiceType === 'Abono' ? -rowDraft.f1Invoice.invoices[0].totalAmount : rowDraft.f1Invoice.invoices[0].totalAmount).toFixed(2)} €`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center items-center gap-2">
                          {rowDraft.f1Invoice?.invoices && rowDraft.f1Invoice.invoices.length > 0 ? (
                            <div className="flex items-center gap-1" title="F1 ya ha sido facturado por el proveedor">
                              <CheckCircle size={16} className="text-[var(--lime)]" />
                              {rowDraft.f1Invoice.invoices[0].pdfUrl && (
                                <a href={rowDraft.f1Invoice.invoices[0].pdfUrl} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white" title="Ver factura del proveedor">
                                  <FileText size={16} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                          {rowDraft.f1Invoice?.xmlUrl && (
                            <a href={rowDraft.f1Invoice.xmlUrl} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Descargar XML F1 original">
                              <Download size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleToggleHidden(rowDraft.id, rowDraft.hidden)} 
                            className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" 
                            title={rowDraft.hidden ? "Mostrar" : "Ocultar"}
                          >
                            {rowDraft.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                          <button onClick={() => handleRecalculateSingle(rowDraft.id)} className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Forzar Recálculo">
                            <RefreshCw size={16} />
                          </button>
                          <a href={`/api/facturacion/interna/export-excel/${rowDraft.id}`} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-[#217346] inline-flex items-center" title="Descargar Desglose Excel">
                            <Table size={16} />
                          </a>
                          <a href={`/api/facturacion/interna/proforma/${rowDraft.id}`} target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-white inline-flex items-center" title="Descargar PDF Proforma">
                            <FileText size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                    );
                  };

                  if (isOrphanAR || isOrphanDuplicateN) {
                    rows.push(renderRow(draft, isOrphanAR, false, false));
                  } else {
                    rows.push(renderRow(draft, false, false, !!arDraft || !!nDraft));
                    if (arDraft) rows.push(renderRow(arDraft, true, false, true));
                    if (nDraft) rows.push(renderRow(nDraft, false, true, true));
                  }
                  
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}

          {validDrafts.length === 0 && (
            <div className="card text-center py-6 text-[var(--text-muted)]">
              No hay borradores listos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
