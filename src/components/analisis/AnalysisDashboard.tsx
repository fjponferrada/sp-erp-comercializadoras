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
        <div className="card relative overflow-hidden" style={{ padding: '24px' }}>
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
        <div className="card relative overflow-hidden" style={{ padding: '24px' }}>
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
        <div className="card relative overflow-hidden" style={{ padding: '24px' }}>
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
        <div className="card relative overflow-hidden" style={{ padding: '24px' }}>
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
        <div className="card" style={{ padding: '24px' }}>
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
        <div className="card" style={{ padding: '24px' }}>
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
        <div className="card mt-8" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-lg font-bold text-white">Rendimiento Histórico Mensual</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ padding: '16px 24px' }}>Mes</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Facturación €</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Facturación MWh</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>€/MWh</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Margen €</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>Altas / Bajas</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Activos Totales (MWh)</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Crecimiento %</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row) => (
                <tr key={row.month}>
                  <td style={{ padding: '16px 24px', fontWeight: 500, color: '#fff' }}>{row.month}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 500, color: 'var(--info)' }}>
                    {row.facturacionEur.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {(row.facturacionMwh / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MWh
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 500, color: '#e2e8f0' }}>
                    {(row.eurPerMwh * 1000).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 500, color: 'var(--warning)' }}>
                    {row.margenEur.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 500 }}>+{row.altas}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 500 }}>-{row.bajas}</span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 500, color: '#818cf8' }}>
                    {row.mwhActivos.toLocaleString('es-ES', { maximumFractionDigits: 1 })} MWh
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span className={row.crecimientoMes >= 0 ? 'badge badge-active' : 'badge badge-draft'} style={row.crecimientoMes >= 0 ? { color: 'var(--success)', borderColor: 'var(--success)' } : { color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      {row.crecimientoMes >= 0 ? '+' : ''}{(row.crecimientoMes * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
