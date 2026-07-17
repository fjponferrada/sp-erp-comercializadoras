'use client';

import React, { useState } from 'react';
import { requestPaymentTransferAction } from '@/app/actions/invoiceActions';
import { Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RequestPaymentButton({ invoiceId, type = 'transfer', disabled }: { invoiceId: string, type?: 'transfer' | 'overdue', disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRequest = () => {
    if (disabled) return;
    const msg = type === 'overdue' 
      ? "¿Deseas enviar un email de FACTURA VENCIDA a este cliente?"
      : "¿Deseas enviar un email al cliente solicitando el pago de esta factura por transferencia?";
      
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary, #f8fafc)' }}>{msg}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            onClick={() => toast.dismiss(t.id)}
            style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border, #334155)', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              setLoading(true);
              const loadingToast = toast.loading(type === 'overdue' ? "Enviando aviso de vencimiento..." : "Enviando solicitud de pago...");
              const res = await requestPaymentTransferAction(invoiceId, type);
              setLoading(false);
              toast.dismiss(loadingToast);
              
              if (res.success) {
                toast.success("Email enviado correctamente.");
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
              } else {
                toast.error(`Error: ${res.error}`);
              }
            }}
            style={{ padding: '6px 12px', borderRadius: '6px', background: type === 'overdue' ? '#fb7185' : '#fbbf24', border: `1px solid ${type === 'overdue' ? '#fb7185' : '#fbbf24'}`, color: '#000', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Aceptar
          </button>
        </div>
      </div>
    ), { duration: Infinity, id: `confirm-request-${invoiceId}-${type}` });
  };

  if (success) {
    return <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle size={14} /> Enviado</span>;
  }

  const isOverdue = type === 'overdue';

  return (
    <button 
      type="button"
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
