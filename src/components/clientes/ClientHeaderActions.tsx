'use client';

import React, { useState } from 'react';
import EditClientModal from './EditClientModal';

export default function ClientHeaderActions({ client, userRole }: { client: any, userRole?: string }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const canEdit = !['COMERCIAL', 'CANAL'].includes(userRole || '');

  return (
    <>
      <div className="flex gap-3">
        {canEdit && (
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors border border-slate-700"
          >
            Editar Datos
          </button>
        )}
      </div>

      {isEditModalOpen && (
        <EditClientModal 
          client={client} 
          onClose={() => setIsEditModalOpen(false)} 
        />
      )}
    </>
  );
}
