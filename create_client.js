const fs = require('fs');

const content = "use client";

import React, { useState, useMemo } from 'react';
import { Search, Download, CheckCircle, Mail, Loader2 } from 'lucide-react';
import DeletePenaltyButton from '@/components/DeletePenaltyButton';
import { sendSelectedPenaltyInvoicesAction, markSelectedPenaltyInvoicesAsCommunicatedAction } from '@/app/actions/penaltyInvoiceActions';

export default function FacturasPenalizacionesClient({ initialInvoices }: { initialInvoices: any[] }) {
  const [clientInvoices, setClientInvoices] = useState(initialInvoices);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return clientInvoices.filter(inv => 
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.client?.businessName?.toLowerCase().includes(term) ||
      inv.client?.vatNumber?.toLowerCase().includes(term) ||
      inv.supplyPoint?.cups?.toLowerCase().includes(term)
    );
  }, [searchTerm, clientInvoices]);

  const toggleAll = () => {
    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const toggleOne = (id, index, shiftKey) => {
    const newSet = new Set(selectedIds);
    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        newSet.add(filteredInvoices[i].id);
      }
    } else {
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
    }
    setSelectedIds(newSet);
    setLastSelectedIndex(index);
  };

  const handleMarkAsCommunicated = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(\¿Seguro que quieres marcar \ facturas como comunicadas SIN enviar email?\)) return;

    setLoading(true);
    setMessage(null);
    const res = await markSelectedPenaltyInvoicesAsCommunicatedAction(Array.from(selectedIds));
    setLoading(false);
    
    if (res.success) {
      setMessage(res.message || 'Hecho');
      setClientInvoices(prev => prev.map(inv => 
        selectedIds.has(inv.id) ? { ...inv, status: 'COMUNICADA' } : inv
      ));
      setSelectedIds(new Set());
      setTimeout(() => setMessage(null), 4000);
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(\¿Seguro que quieres enviar \ facturas a los clientes?\)) return;

    setLoading(true);
    setMessage(null);
    const res = await sendSelectedPenaltyInvoicesAction(Array.from(selectedIds));
    setLoading(false);
    
    if (res.success) {
      setMessage(res.message || 'Hecho');
      setClientInvoices(prev => prev.map(inv => 
        selectedIds.has(inv.id) && inv.client?.contactEmail ? { ...inv, status: 'COMUNICADA' } : inv
      ));
      setSelectedIds(new Set());
      setTimeout(() => setMessage(null), 4000);
    } else {
      alert('Error: ' + res.error);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div className="animate-fade-in-up delay-300 flex flex-col gap-4" style={{ marginBottom: '24px' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div style={{ position: 'relative', flex: '1', maxWidth: '500px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input 
              type="text" 
              placeholder="Buscar por Nº Factura, Nombre, CIF o CUPS..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <div className="flex items-center gap-2">
            {message && <span className="text-sm text-emerald-400 flex items-center gap-1 mr-4"><CheckCircle size={14} /> {message}</span>}
            <button 
              onClick={handleMarkAsCommunicated}
              disabled={loading || selectedIds.size === 0}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Marcar Comunicadas ({selectedIds.size})
            </button>
            <button 
              onClick={handleSend}
              disabled={loading || selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
              Comunicar ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Factura</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>CUPS</th>
                <th>Producto</th>
                <th>Importe (con IVA)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No hay facturas de penalización generadas
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, index) => (
                  <tr key={inv.id} style={{ background: selectedIds.has(inv.id) ? 'rgba(99, 102, 241, 0.05)' : '', transition: 'background 0.2s ease' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(inv.id)} 
                        onChange={(e) => {e.stopPropagation(); toggleOne(inv.id, index, e.nativeEvent.shiftKey)}}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                      {inv.status === 'COMUNICADA' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', background: '#22c55e', color: 'white', padding: '2px 8px', borderRadius: '12px', marginTop: '4px' }}>
                          <CheckCircle size={10} /> Comunicada
                        </span>
                      )}
                    </td>
                    <td>{new Date(inv.issueDate).toLocaleDateString('es-ES')}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.client.businessName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.client.vatNumber}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{inv.supplyPoint.cups}</td>
                    <td>{inv.contract?.product?.name || '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{(inv.amount ? inv.amount : 0).toFixed(2)} €</td>

                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '6px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Download size={14} /> PDF
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                        <DeletePenaltyButton id={inv.id} invoiceNumber={inv.invoiceNumber} />
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
  );
}
;

fs.writeFileSync('src/app/(app)/facturas-penalizaciones/FacturasPenalizacionesClient.tsx', content, 'utf8');
