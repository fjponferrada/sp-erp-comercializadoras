import React from 'react';
import { getEconomicAnalysis } from '@/app/actions/analysisActions';
import AnalysisDashboard from '@/components/analisis/AnalysisDashboard';
import { BarChart3 } from 'lucide-react';

export default async function AnalisisPage() {
  const data = await getEconomicAnalysis();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-indigo-500" />
            Análisis Económico
          </h1>
          <p className="text-slate-400 mt-1">Dashboard ejecutivo con KPIs de facturación y evolución de cartera</p>
        </div>
      </div>
      
      {/* Pasamos los datos calculados en el backend al componente de gráficos en cliente */}
      <AnalysisDashboard data={data} />
    </div>
  );
}
