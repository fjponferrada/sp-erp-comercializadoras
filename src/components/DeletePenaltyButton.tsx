'use client';

import React, { useState } from 'react';
import { Trash2, FileMinus2, Loader2 } from 'lucide-react';
import {
  deletePenaltyInvoiceAction,
  issuePenaltyCreditNoteAction,
} from '@/app/actions/deletePenaltyAction';

interface DeletePenaltyButtonProps {
  id: string;
  invoiceNumber: string;
  status?: string;
  invoiceType?: string;
  paymentStatus?: string;
  hasRectifications?: boolean;
  userRole?: string;
  onCompleted?: (msg?: string) => void;
}

export default function DeletePenaltyButton({
  id,
  invoiceNumber,
  status = 'EMITIDA',
  invoiceType = 'PENALIZACION',
  paymentStatus = 'PENDIENTE',
  hasRectifications = false,
  userRole = 'BACKOFFICE',
  onCompleted,
}: DeletePenaltyButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isCommunicated = status === 'COMUNICADA';
  const isAbono = invoiceType === 'ABONO';
  const isSuperAdmin = userRole === 'SUPERADMIN';

  if (!isAbono && (paymentStatus === 'ANULADA' || hasRectifications)) {
    return null;
  }

  const handleIssueAbono = async () => {
    setIsProcessing(true);
    const res = await issuePenaltyCreditNoteAction(id);
    setIsProcessing(false);
    if (res.success) {
      setShowModal(false);
      onCompleted?.(res.message || `Abono emitido para ${invoiceNumber}`);
    } else {
      alert('Error al emitir abono: ' + res.error);
    }
  };

  const handlePhysicalDelete = async (force: boolean = false) => {
    setIsProcessing(true);
    const res = await deletePenaltyInvoiceAction(id, force);
    setIsProcessing(false);
    if (res.success) {
      setShowModal(false);
      onCompleted?.(`Factura ${invoiceNumber} eliminada.`);
    } else {
      alert('Error al eliminar: ' + res.error);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isProcessing}
        className="btn-secondary"
        style={{
          padding: '6px 8px',
          color: '#ef4444',
          borderColor: 'rgba(239, 68, 68, 0.22)',
          background: 'rgba(239, 68, 68, 0.06)',
        }}
        title={
          isCommunicated && !isAbono
            ? 'Emitir Factura Rectificativa (Abono)'
            : 'Anular o eliminar factura'
        }
      >
        {isCommunicated && !isAbono ? <FileMinus2 size={15} /> : <Trash2 size={15} />}
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="card" style={{ width: '440px', maxWidth: '100%', padding: '24px' }}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: '12px',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileMinus2 size={20} />
              {isAbono ? 'Eliminar Abono' : 'Anular / Rectificar Penalización'}
            </h3>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
              Documento seleccionado: <strong>{invoiceNumber}</strong>
              {isCommunicated ? ' (Ya comunicada al cliente)' : ' (Pendiente de comunicar)'}
            </p>

            {!isAbono && (
              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  marginBottom: '18px',
                  lineHeight: '1.5',
                  padding: '12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                {isCommunicated ? (
                  <>
                    Al haber sido <strong>comunicada al cliente</strong>, la práctica contable
                    correcta es emitir una <strong>Factura Rectificativa (Abono AB-{invoiceNumber})</strong>{' '}
                    con importe negativo, devolviendo el contrato a estado Pendiente en Bajas.
                  </>
                ) : (
                  <>
                    Como aún <strong>no ha sido comunicada</strong>, puedes eliminarla físicamente
                    (borrando su PDF en R2 si no es compartido) o bien emitir un Abono contable.
                  </>
                )}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={isProcessing}
              >
                Cancelar
              </button>

              {!isAbono && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    background: '#dc2626',
                    borderColor: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={handleIssueAbono}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileMinus2 size={14} />
                  )}
                  Emitir Abono (AB-{invoiceNumber})
                </button>
              )}

              {(!isCommunicated || isSuperAdmin) && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    color: '#f87171',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => handlePhysicalDelete(isCommunicated && isSuperAdmin)}
                  disabled={isProcessing}
                >
                  <Trash2 size={14} />
                  {isCommunicated && isSuperAdmin
                    ? 'Borrado Físico (Superadmin)'
                    : 'Eliminar Físicamente'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
