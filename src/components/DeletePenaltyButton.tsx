'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deletePenaltyInvoiceAction } from '@/app/actions/deletePenaltyAction';
import { useRouter } from 'next/navigation';

export default function DeletePenaltyButton({ id, invoiceNumber }: { id: string, invoiceNumber: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    const res = await deletePenaltyInvoiceAction(id);
    if (res.success) {
      router.refresh();
      setShowModal(false);
    } else {
      alert('Error al eliminar: ' + res.error);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        disabled={isDeleting}
        className="btn-secondary" 
        style={{ padding: '6px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
        title="Eliminar factura"
      >
        <Trash2 size={16} />
      </button>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={20} />
              Eliminar Penalización
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              ¿Estás seguro de que quieres eliminar la factura <strong>{invoiceNumber}</strong>?
            </p>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              Esta acción es irreversible. Se eliminará el documento PDF y el registro de la factura, devolviendo la penalización al estado "Pendiente" en el panel de Bajas.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowModal(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar Factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
