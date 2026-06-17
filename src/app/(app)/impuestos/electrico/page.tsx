import React from 'react';
import { Receipt } from 'lucide-react';
import ElectricoClient from './ElectricoClient';

export default function ImpuestoElectricoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Receipt className="text-rose-500" />
          Impuesto Eléctrico
        </h1>
        <p className="text-slate-400 mt-1">Gestión y liquidación del Impuesto Especial sobre la Electricidad</p>
      </div>

      <ElectricoClient />
    </div>
  );
}
