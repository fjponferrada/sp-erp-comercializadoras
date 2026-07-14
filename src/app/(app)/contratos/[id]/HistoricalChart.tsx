'use client';

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface HistoricalChartProps {
  invoices: any[];
}

export default function HistoricalChart({ invoices }: HistoricalChartProps) {
  const data = useMemo(() => {
    if (!invoices || invoices.length === 0) return [];

    const grouped = invoices.reduce((acc: Record<string, any>, inv: any) => {
      // Group by Month-Year based on issueDate
      const date = new Date(inv.issueDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

      if (!acc[key]) {
        acc[key] = {
          key,
          label,
          timestamp: date.getTime(),
          totalMWh: 0,
          totalAmount: 0
        };
      }

      // Check if it's an Abono to invert the sign
      const isAbono = inv.invoiceType === 'Abono' || inv.invoiceType === 'ABONO';
      const mwh = isAbono ? -Math.abs(inv.totalMWh || 0) : (inv.totalMWh || 0);
      const amount = isAbono ? -Math.abs(inv.totalAmount || 0) : (inv.totalAmount || 0);

      // Add to totals
      acc[key].totalMWh += mwh;
      acc[key].totalAmount += amount;

      return acc;
    }, {});

    // Convert to array and sort by date ascending
    return Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [invoices]);

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
        No hay datos históricos disponibles para este CUPS.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] p-4 rounded-lg shadow-lg">
          <p className="font-bold text-white mb-2 capitalize">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-6 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-gray-300 text-sm">{entry.name}</span>
              </div>
              <span className="font-mono text-sm text-white font-medium">
                {entry.value.toLocaleString('es-ES', { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2 
                })} {entry.name === 'Total Facturado' ? '€' : 'kWh'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="label" 
            stroke="#9ca3af" 
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            yAxisId="left" 
            orientation="left" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(val) => `${val.toLocaleString('es-ES')} €`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(val) => `${val.toLocaleString('es-ES')} kWh`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          {/* Consumo Bar */}
          <Bar 
            yAxisId="right"
            name="Consumo" 
            dataKey="totalMWh" 
            fill="#475569"
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />
          
          {/* Precio Line */}
          <Line 
            yAxisId="left"
            name="Total Facturado" 
            type="monotone" 
            dataKey="totalAmount" 
            stroke="var(--lime)" 
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--lime)', strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
