import React from 'react';
import { prisma } from '@/lib/prisma';
import { Sun, Plus } from 'lucide-react';
import KanbanBoard from '@/components/autoconsumo/KanbanBoard';
import NewSolarQuoteModal from '@/components/autoconsumo/NewSolarQuoteModal';

export default async function AutoconsumoPage() {
  const quotes = await prisma.solarQuote.findMany({
    include: {
      client: true,
      supplyPoint: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sun className="text-amber-400" />
            Autoconsumo e Instalaciones
          </h1>
          <p className="text-slate-400 mt-1">Kanban de expedientes de placas solares, legalizaciones y CIEs</p>
        </div>
        
        {/* Aquí inyectaremos el botón cliente interactivo */}
        <NewSolarQuoteModal />
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard initialQuotes={quotes} />
      </div>
    </div>
  );
}
