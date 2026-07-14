'use client';

import React, { useState } from 'react';
import { requestPaymentTransferAction } from '@/app/actions/invoiceActions';
import { Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export default function RequestPaymentButton({ invoiceId, type = 'transfer', disabled }: { invoiceId: string, type?: 'transfer' | 'overdue', disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRequest = async () => {
    if (disabled) return;
    const msg = type === 'overdue' 
      ? "¿Deseas enviar un email de FACTURA VENCIDA a este cliente?"
      : "¿Deseas enviar un email al cliente solicitando el pago de esta factura por transferencia?";
      
    if (!confirm(msg)) return;

    setLoading(true);
    const res = await requestPaymentTransferAction(invoiceId, type);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      alert("Error: " + res.error);
    }
  };

  if (success) {
    return <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle size={14} /> Enviado</span>;
  }

  const isOverdue = type === 'overdue';

  return (
    <button 
      onClick={handleRequest}
      disabled={disabled || loading}
      className={`btn-ghost tooltip-trigger ${isOverdue ? '!text-rose-400 hover:!bg-rose-500/10' : '!text-amber-400 hover:!bg-amber-500/10'} disabled:!opacity-50`}
      title={isOverdue ? "Aviso de Factura Vencida" : "Solicitar pago por transferencia"}
      style={{ padding: '6px' }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : (isOverdue ? <AlertCircle size={16} /> : <Mail size={16} />)}
    </button>
  );
}
