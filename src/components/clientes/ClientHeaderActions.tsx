'use client';

import React, { useState } from 'react';
import EditClientModal from './EditClientModal';

export default function ClientHeaderActions({ client }: { client: any }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-3">
        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors border border-slate-700"
        >
          Editar Datos
        </button>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          Nuevo Contrato
        </button>
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
