'use client';

import React, { useState } from 'react';
import { sendSelectedInvoicesAction, markSelectedInvoicesAsCommunicatedAction } from '@/app/actions/invoiceActions';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SendInvoicesButton({
  selectedInvoiceIds,
  onSentSuccess,
}: {
  selectedInvoiceIds: string[];
  onSentSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (selectedInvoiceIds.length === 0) {
      toast.error('No hay facturas seleccionadas.');
      return;
    }

    if (!confirm(`¿Seguro que quieres enviar por email ${selectedInvoiceIds.length} facturas seleccionadas a sus clientes?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await sendSelectedInvoicesAction(selectedInvoiceIds);
      if (res.success) {
        if ((res.sentCount || 0) > 0) {
          toast.success(res.message || 'Facturas enviadas con éxito.');
        } else {
          toast(res.message || 'Ninguna factura cumplía requisitos de envío.', { icon: 'ℹ️' });
        }
        if (onSentSuccess) onSentSuccess();
      } else {
        toast.error(`Error: ${res.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCommunicated = async () => {
    if (selectedInvoiceIds.length === 0) {
      toast.error('No hay facturas seleccionadas.');
      return;
    }

    if (!confirm(`¿Seguro que quieres marcar ${selectedInvoiceIds.length} facturas como comunicadas SIN enviar email?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await markSelectedInvoicesAsCommunicatedAction(selectedInvoiceIds);
      if (res.success) {
        toast.success(res.message || 'Facturas marcadas como comunicadas.');
        if (onSentSuccess) onSentSuccess();
      } else {
        toast.error(`Error: ${res.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleMarkAsCommunicated}
        disabled={loading || selectedInvoiceIds.length === 0}
        className="btn-secondary disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
        Marcar Comunicadas ({selectedInvoiceIds.length})
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={loading || selectedInvoiceIds.length === 0}
        className="btn-secondary disabled:opacity-50"
        style={{
          background: selectedInvoiceIds.length > 0 ? 'rgba(99, 102, 241, 0.15)' : undefined,
          borderColor: selectedInvoiceIds.length > 0 ? 'rgba(99, 102, 241, 0.45)' : undefined,
          color: selectedInvoiceIds.length > 0 ? '#818cf8' : undefined,
        }}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
        Comunicar ({selectedInvoiceIds.length})
      </button>
    </div>
  );
}
