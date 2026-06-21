'use client';

import React, { useState } from 'react';
import { sendSelectedInvoicesAction } from '@/app/actions/invoiceActions';
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

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> {result}</span>}
      <button 
        onClick={handleSend}
        disabled={loading || selectedInvoiceIds.length === 0}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
        Comunicar Seleccionadas ({selectedInvoiceIds.length})
      </button>
    </div>
  );
}
