'use client';

import React, { useState } from 'react';
import { sendSelectedInvoicesAction, markSelectedInvoicesAsCommunicatedAction } from '@/app/actions/invoiceActions';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

export default function SendInvoicesButton({ selectedInvoiceIds, onSentSuccess }: { selectedInvoiceIds: string[], onSentSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSend = async () => {
    if (selectedInvoiceIds.length === 0) {
      alert("No hay facturas seleccionadas.");
      return;
    }
    
    if (!confirm(`¿Seguro que quieres enviar ${selectedInvoiceIds.length} facturas a los clientes?`)) return;

    setLoading(true);
    setResult(null);

    const res = await sendSelectedInvoicesAction(selectedInvoiceIds);
    
    setLoading(false);
    if (res.success) {
      setResult(res.message || 'Facturas enviadas con éxito.');
      setTimeout(() => setResult(null), 5000);
      if (onSentSuccess) onSentSuccess();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleMarkAsCommunicated = async () => {
    if (selectedInvoiceIds.length === 0) {
      alert("No hay facturas seleccionadas.");
      return;
    }
    
    if (!confirm(`¿Seguro que quieres marcar ${selectedInvoiceIds.length} facturas como comunicadas SIN enviar email?`)) return;

    setLoading(true);
    setResult(null);

    const res = await markSelectedInvoicesAsCommunicatedAction(selectedInvoiceIds);
    
    setLoading(false);
    if (res.success) {
      setResult(res.message || 'Facturas marcadas con éxito.');
      setTimeout(() => setResult(null), 5000);
      if (onSentSuccess) onSentSuccess();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> {result}</span>}
      <button 
        onClick={handleMarkAsCommunicated}
        disabled={loading || selectedInvoiceIds.length === 0}
        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
        Marcar Comunicadas ({selectedInvoiceIds.length})
      </button>
      <button 
        onClick={handleSend}
        disabled={loading || selectedInvoiceIds.length === 0}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
        Comunicar ({selectedInvoiceIds.length})
      </button>
    </div>
  );
}
