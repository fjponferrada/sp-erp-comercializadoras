'use client';

import { useState } from 'react';
import { Calculator, CheckCircle, FileText, AlertCircle, RefreshCw, Eye, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FacturacionClient({ pendingF1s, drafts }: { pendingF1s: any[], drafts: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'REPAIR' | 'DRAFTS'>('PENDING');
  const [selectedF1s, setSelectedF1s] = useState<string[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [selectedRepairDrafts, setSelectedRepairDrafts] = useState<string[]>([]);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validDrafts = drafts.filter(d => d.status === 'BORRADOR');
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
      if (!res.ok) throw new Error((await res.json()).message || 'Error al reparar facturas');
      
      setSelectedRepairDrafts([]);
      setActiveTab('DRAFTS');
      router.refresh();
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsRepairing(false);
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
          onClick={() => setActiveTab('REPAIR')}
          className={`px-4 py-2 font-semibold text-sm rounded-t-md transition-colors ${activeTab === 'REPAIR' ? 'text-red-500 border-b-2 border-red-500' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          Requieren Reparación ({repairDrafts.length})
        </button>
        <button 
          onClick={() => setActiveTab('DRAFTS')}
          className={`px-4 py-2 font-semibold text-sm rounded-t-md transition-colors ${activeTab === 'DRAFTS' ? 'text-[var(--lime)] border-b-2 border-[var(--lime)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          Borradores Válidos ({validDrafts.length})
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
                  <th className="px-4 py-3 text-right">Base F1 (€)</th>
                </tr>
              </thead>
              <tbody>
                {pendingF1s.map((f1) => (
                  <tr key={f1.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selectedF1s.includes(f1.id)} onChange={() => toggleSelect(f1.id, setSelectedF1s, selectedF1s)} /></td>
                    <td className="px-4 py-3 font-mono">{f1.numeroFactura || 'S/N'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{f1.contract?.supplyPoint?.cups}</td>
                    <td className="px-4 py-3">{f1.contract?.client?.businessName || f1.contract?.client?.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{f1.baseImponible?.toFixed(2)} €</td>
                  </tr>
                ))}
                {pendingF1s.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-[var(--text-muted)]">No hay facturas F1 pendientes.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPAIR TAB */}
      {activeTab === 'REPAIR' && (
        <div className="card border border-red-500/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
              <AlertCircle size={20} /> Descuadres Detectados (F1 vs CCH)
            </h2>
            <button className="btn bg-red-500 hover:bg-red-600 text-white border-none" disabled={selectedRepairDrafts.length === 0 || isRepairing} onClick={handleRepair}>
              {isRepairing ? <RefreshCw className="animate-spin" size={18} /> : <Wrench size={18} />}
              Reparar y Facturar ({selectedRepairDrafts.length})
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" className="rounded" onChange={(e) => setSelectedRepairDrafts(e.target.checked ? repairDrafts.map(d => d.id) : [])} checked={selectedRepairDrafts.length === repairDrafts.length && repairDrafts.length > 0} /></th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Problema Detectado</th>
                  <th className="px-4 py-3 text-right">F1 (kWh)</th>
                  <th className="px-4 py-3 text-right">CCH (kWh)</th>
                </tr>
              </thead>
              <tbody>
                {repairDrafts.map((draft) => {
                  const rData = draft.repairData || {};
                  return (
                  <tr key={draft.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selectedRepairDrafts.includes(draft.id)} onChange={() => toggleSelect(draft.id, setSelectedRepairDrafts, selectedRepairDrafts)} /></td>
                    <td className="px-4 py-3 font-semibold">{draft.contract?.client?.businessName || draft.contract?.client?.name}</td>
                    <td className="px-4 py-3 text-red-400">{rData.issue || 'Descuadre desconocido'}</td>
                    <td className="px-4 py-3 text-right font-bold">{rData.f1Volume !== undefined ? (rData.f1Volume * 1000).toFixed(0) : 0}</td>
                    <td className="px-4 py-3 text-right">{rData.cchVolume !== undefined ? (rData.cchVolume * 1000).toFixed(0) : 0}</td>
                  </tr>
                )})}
                {repairDrafts.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-[var(--text-muted)]">No hay facturas bloqueadas por descuadre.</td></tr>}
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
              <CheckCircle size={20} className="text-[var(--lime)]" /> Borradores Válidos
            </h2>
            <button className="btn btn-primary" disabled={selectedDrafts.length === 0 || isConfirming} onClick={handleConfirm}>
              {isConfirming ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              Confirmar Facturas ({selectedDrafts.length})
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" className="rounded" onChange={(e) => setSelectedDrafts(e.target.checked ? validDrafts.map(d => d.id) : [])} checked={selectedDrafts.length === validDrafts.length && validDrafts.length > 0} /></th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Periodo</th>
                  <th className="px-4 py-3 text-right">Consumo (kWh)</th>
                  <th className="px-4 py-3 text-right">Base (€)</th>
                  <th className="px-4 py-3 text-right">Total (€)</th>
                </tr>
              </thead>
              <tbody>
                {validDrafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selectedDrafts.includes(draft.id)} onChange={() => toggleSelect(draft.id, setSelectedDrafts, selectedDrafts)} /></td>
                    <td className="px-4 py-3 font-semibold">{draft.contract?.client?.businessName || draft.contract?.client?.name}</td>
                    <td className="px-4 py-3">{draft.billingStart ? new Date(draft.billingStart).toLocaleDateString() : '-'} a {draft.billingEnd ? new Date(draft.billingEnd).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-right">{(draft.totalMWh * 1000).toFixed(2)} kWh</td>
                    <td className="px-4 py-3 text-right">{draft.subtotal1?.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--lime)]">{draft.totalAmount?.toFixed(2)} €</td>
                  </tr>
                ))}
                {validDrafts.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-[var(--text-muted)]">No hay borradores listos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
