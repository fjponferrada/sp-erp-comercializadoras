'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { savePenaltyAction } from '@/app/actions/bajasActions';

export default function PenalizationModal({
  contract,
  onClose,
}: {
  contract: any;
  onClose: () => void;
}) {
  const router = useRouter();
  const initialAmount =
    contract?.penalization !== null && contract?.penalization !== undefined
      ? Number(contract.penalization).toFixed(2)
      : contract?.calculatedPenalty
        ? Number(contract.calculatedPenalty).toFixed(2)
        : '0.00';

  const [editingPenalty, setEditingPenalty] = useState<string>(initialAmount);
  const [saving, setSaving] = useState(false);

  if (!contract) return null;

  const isAlreadyInvoiced = contract.penaltyStatus === 'FACTURADA';
  const baseNum = Math.max(0, parseFloat(editingPenalty) || 0);
  const totalWithVat = baseNum * 1.21;

  const handleAction = async (status: 'PENDIENTE' | 'DESCARTADA' | 'FACTURADA', generatePdf: boolean) => {
    setSaving(true);
    const res = await savePenaltyAction(contract.id, baseNum, status, generatePdf);
    setSaving(false);
    if (res.success) {
      router.refresh();
      onClose();
    } else {
      alert('Error al procesar penalización: ' + res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Gestionar Penalización por Baja
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 text-xs text-slate-300 space-y-1">
          <div>
            <strong>Contrato:</strong> {contract.contractCode || contract.id.slice(0, 8)}
          </div>
          {contract.calculatedPenalty != null && (
            <div>
              <strong>Cálculo Automático ERP (Base):</strong>{' '}
              {Number(contract.calculatedPenalty).toFixed(2)} €
            </div>
          )}
          <div>
            <strong>Estado actual:</strong> {contract.penaltyStatus || 'PENDIENTE'}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Base Imponible Penalización (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={editingPenalty}
            onChange={(e) => setEditingPenalty(e.target.value)}
            disabled={isAlreadyInvoiced || saving}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-base focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            {isAlreadyInvoiced
              ? 'Esta penalización ya está facturada. Gestiona abonos o anulaciones desde Facturas de Penalizaciones.'
              : `Total con IVA (21%): ${totalWithVat.toFixed(2)} €`}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Cerrar
          </button>
          {!isAlreadyInvoiced && (
            <>
              <button
                type="button"
                onClick={() => handleAction('DESCARTADA', false)}
                disabled={saving}
                className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
              >
                Descartar (0 €)
              </button>
              <button
                type="button"
                onClick={() => handleAction('FACTURADA', true)}
                disabled={saving || baseNum <= 0}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileText size={14} />
                )}
                Emitir Factura PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
