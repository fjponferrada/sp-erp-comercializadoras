'use client';

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, ComposedChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Euro, Zap } from 'lucide-react';

export default function AnalysisDashboard({ data }: { data: any[] }) {
  
  // Extraemos KPIs del último mes disponible (o acumulado global)
  const lastMonth = data.length > 0 ? data[data.length - 1] : null;
  const totalFacturacion = data.reduce((acc, curr) => acc + curr.facturacionEur, 0);
  const totalMwhActivos = lastMonth ? lastMonth.mwhActivos : 0;
  const totalContratosActivos = lastMonth ? lastMonth.contratosActivos : 0;
  const growthRate = lastMonth ? (lastMonth.crecimientoMes * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* KPIs Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1 */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Contratos Activos</p>
              <h3 className="text-3xl font-bold text-white mt-1">{totalContratosActivos}</h3>
            </div>
            <div className="bg-indigo-500/20 p-3 rounded-xl">
              <Activity className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <div className="flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-400 mr-1" />
            <span className="text-emerald-400 font-medium">+{lastMonth?.altas || 0} este mes</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Facturación Acumulada</p>
              <h3 className="text-3xl font-bold text-white mt-1">
                {totalFacturacion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </h3>
            </div>
            <div className="bg-rose-500/20 p-3 rounded-xl">
              <Euro className="w-6 h-6 text-rose-400" />
            </div>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-slate-400 font-medium">Desde el inicio de operaciones</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Volumen Vivo (MWh)</p>
              <h3 className="text-3xl font-bold text-white mt-1">{totalMwhActivos.toLocaleString('es-ES', { maximumFractionDigits: 0 })} MWh</h3>
            </div>
            <div className="bg-emerald-500/20 p-3 rounded-xl">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center text-sm">
            {Number(growthRate) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400 mr-1" />
            )}
            <span className={`${Number(growthRate) >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-medium`}>
              {growthRate}% crecimiento mensual
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Margen Medio / MWh</p>
              <h3 className="text-3xl font-bold text-white mt-1">
                {lastMonth?.facturacionMwh ? ((lastMonth.margenEur / lastMonth.facturacionMwh) * 1000).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '0,00 €'}
              </h3>
            </div>
            <div className="bg-amber-500/20 p-3 rounded-xl">
              <Activity className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-slate-400 font-medium">En el último mes cerrado</span>
          </div>
        </div>
      </div>

      {/* Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolución de Cartera */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Evolución de Cartera (MWh)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar yAxisId="left" dataKey="mwhAltas" name="Altas MWh" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar yAxisId="left" dataKey="mwhBajas" name="Bajas MWh" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                <Line yAxisId="right" type="monotone" dataKey="mwhActivos" name="Total Activos MWh" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#1e293b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Facturación vs Margen */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Facturación Mensual (€)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k€`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                  formatter={(value: any) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="facturacionEur" name="Facturación Bruta" fill="#38bdf8" stroke="#38bdf8" fillOpacity={0.2} strokeWidth={2} />
                <Bar dataKey="margenEur" name="Margen Comercial" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabla Detallada */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">Rendimiento Histórico Mensual</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Mes</th>
                <th className="px-6 py-4 text-right">Facturación €</th>
                <th className="px-6 py-4 text-right">Facturación MWh</th>
                <th className="px-6 py-4 text-right">€/MWh</th>
                <th className="px-6 py-4 text-right">Margen €</th>
                <th className="px-6 py-4 text-center">Altas / Bajas</th>
                <th className="px-6 py-4 text-right">Activos Totales (MWh)</th>
                <th className="px-6 py-4 text-right">Crecimiento %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[...data].reverse().map((row) => (
                <tr key={row.month} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{row.month}</td>
                  <td className="px-6 py-4 text-right font-medium text-sky-400">
                    {row.facturacionEur.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">
                    {row.facturacionMwh.toLocaleString('es-ES', { maximumFractionDigits: 1 })} MWh
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-200">
                    {(row.eurPerMwh * 1000).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-amber-400">
                    {row.margenEur.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-emerald-400 font-medium">+{row.altas}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-rose-400 font-medium">-{row.bajas}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-indigo-400">
                    {row.mwhActivos.toLocaleString('es-ES', { maximumFractionDigits: 1 })} MWh
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${row.crecimientoMes >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {row.crecimientoMes >= 0 ? '+' : ''}{(row.crecimientoMes * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No hay datos suficientes para generar el análisis económico. Sube facturas o activa contratos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
