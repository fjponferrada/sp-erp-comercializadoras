'use client';

import React, { useState } from 'react';
import { sendPendingInvoicesAction } from '@/app/actions/invoiceActions';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

export default function SendInvoicesButton({ pendingCount }: { pendingCount: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSend = async () => {
    if (pendingCount === 0) {
      alert("No hay facturas pendientes de envío.");
      return;
    }
    
    if (!confirm(`¿Seguro que quieres enviar ${pendingCount} facturas a los clientes?`)) return;

    setLoading(true);
    setResult(null);

    const res = await sendPendingInvoicesAction();
    
    setLoading(false);
    if (res.success) {
      setResult(res.message || 'Facturas enviadas con éxito.');
      setTimeout(() => setResult(null), 5000);
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> {result}</span>}
      <button 
        onClick={handleSend}
        disabled={loading || pendingCount === 0}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
        Comunicar a Clientes ({pendingCount})
      </button>
    </div>
  );
}
