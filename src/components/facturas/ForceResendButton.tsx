'use client';

import React, { useState } from 'react';
import { forceResendInvoiceAction } from '@/app/actions/invoiceActions';
import { Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForceResendButton({ invoiceId, disabled }: { invoiceId: string, disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary, #f8fafc)' }}>¿Seguro que quieres forzar el reenvío de esta factura?</p>
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
              const loadingToast = toast.loading("Enviando factura...");
              const res = await forceResendInvoiceAction(invoiceId);
              setLoading(false);
              toast.dismiss(loadingToast);
              
              if (res.success) {
                toast.success("Factura reenviada correctamente.");
              } else {
                toast.error(`Error: ${res.error}`);
              }
            }}
            style={{ padding: '6px 12px', borderRadius: '6px', background: '#8b5cf6', border: '1px solid #8b5cf6', color: 'white', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
          >
            Aceptar
          </button>
        </div>
      </div>
    ), { duration: Infinity, id: `confirm-resend-${invoiceId}` });
  };

  return (
    <button 
      type="button"
      onClick={handleSend}
      disabled={loading || disabled}
      className="action-icon"
      title="Forzar reenvío de email"
      style={{ opacity: loading || disabled ? 0.5 : 1, outline: 'none', border: 'none', background: 'transparent' }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" style={{ color: '#8b5cf6' }} /> : <Mail size={16} style={{ color: '#8b5cf6' }} />}
    </button>
  );
}
