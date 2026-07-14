'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface MonthlyData {
  month: string;
  cierre: string;
  estimatedBcMwh: number;
  liquidatedMwh: number;
  pendingMwh: number;
  estimatedPendingCostEur: number;
  invoicedMwh?: number;
}

export default function EnergiaPendienteClient() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    fetch('/api/gestion/energia-pendiente')
      .then(res => res.json())
      .then(json => {
        if (!json.success) {
          setError(json.error || 'Error desconocido al cargar los datos.');
        } else {
          setData(json.data);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatMwh = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatEur = (val: number) => {
    return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px auto', color: 'var(--lime)' }} />
        <p>Calculando energía pendiente de los últimos 12 meses...</p>
        <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Esto puede tardar unos segundos al procesar los datos horarios de curvas de carga y REE.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AlertCircle size={24} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Energía Pendiente de Liquidar (REE)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <button 
            disabled={isRecalculating}
            onClick={async () => {
              setIsRecalculating(true);
              setProgressMsg('Iniciando recálculo...');
              const t = toast.loading('Iniciando recálculo...');
              try {
                const res = await fetch('/api/gestion/energia-pendiente/recalculate', { method: 'POST' });
                if (!res.body) throw new Error('No stream available');
              
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let done = false;

              while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.substring(6));
                        if (data.msg) {
                          setProgressMsg(data.msg);
                          toast.loading(data.msg, { id: t });
                        }
                        if (data.done) {
                          setProgressMsg('Cálculo finalizado exitosamente');
                          toast.success('Cálculo finalizado exitosamente', { id: t, duration: 5000 });
                          // Recargar datos
                          setLoading(true);
                          fetch('/api/gestion/energia-pendiente')
                            .then(r => r.json())
                            .then(j => { if (j.success) setData(j.data); })
                            .finally(() => {
                              setLoading(false);
                              setIsRecalculating(false);
                              setTimeout(() => setProgressMsg(''), 3000);
                            });
                        }
                        if (data.error) {
                          setProgressMsg('Error: ' + data.error);
                          toast.error(data.error, { id: t });
                          setIsRecalculating(false);
                        }
                      } catch (e) {}
                    }
                  }
                }
              }
            } catch (err: any) {
              setProgressMsg('Error de conexión');
              toast.error(err.message, { id: t });
              setIsRecalculating(false);
            }
          }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', 
            background: isRecalculating ? 'var(--bg-base)' : 'var(--primary)', 
            color: isRecalculating ? 'var(--text-muted)' : 'white', 
            border: isRecalculating ? '1px solid var(--border)' : 'none', 
            borderRadius: '6px', cursor: isRecalculating ? 'not-allowed' : 'pointer', 
            fontWeight: 500, fontSize: '0.9rem', transition: 'all 0.2s' 
          }}
        >
          {isRecalculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {isRecalculating ? 'Procesando...' : 'Recalcular Ahora'}
        </button>
        {isRecalculating && (
          <div style={{ fontSize: '0.8rem', color: 'var(--lime)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--lime)', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
            {progressMsg}
          </div>
        )}
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Este informe cruza la demanda medida en Barras de Central (curvas de carga + pérdidas) con la energía total liquidada por REE (componente CAD de la última liquidación disponible en REGANECU) para estimar los saldos pendientes de liquidación futura.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mes</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Último Cierre</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Energía Facturada</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Demanda BC Estimada</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Liquidado REE</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Energía Pendiente</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Valoración Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isPositiveEnergy = row.pendingMwh > 0;
              const isPositiveCost = row.estimatedPendingCostEur > 0;
              
              // If we owe money to REE (they liquidated less than we consumed, we consumed more, so pendingMwh is > 0)
              // Wait, if Demanda BC > Liquidado REE => We consumed more than we paid for.
              // That means we OWE REE (negative impact on cash flow). Let's show as red?
              // The user just said: "saldo a favor de REE, o a favor de comercializadora".
              // If we consumed more (Demanda BC > Liquidado), we OWE REE.
              // Let's color red if we owe REE, green if REE owes us.
              const colorCode = isPositiveCost ? '#ef4444' : '#22c55e'; // Red if > 0, Green if < 0.

              return (
                <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {row.month}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                      background: row.cierre !== 'N/A' ? 'var(--lime)' : 'var(--bg-base)',
                      color: row.cierre !== 'N/A' ? 'var(--bg-base)' : 'var(--text-muted)'
                    }}>
                      {row.cierre}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {formatMwh(row.invoicedMwh || 0)} MWh
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {formatMwh(row.estimatedBcMwh)} MWh
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {row.cierre !== 'N/A' ? `${formatMwh(row.liquidatedMwh)} MWh` : '-'}
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600, textAlign: 'right', color: colorCode, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {isPositiveEnergy ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {formatMwh(Math.abs(row.pendingMwh))} MWh
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600, color: colorCode, textAlign: 'right' }}>
                    {formatEur(Math.abs(row.estimatedPendingCostEur))} {isPositiveCost ? '(A pagar)' : '(A cobrar)'}
                  </td>
                </tr>
              );
            })}
            
            {data.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay datos disponibles para los últimos 12 meses.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-base)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '8px' }}>
          <strong>Nota:</strong> Los valores positivos ("A pagar" en rojo) indican que el consumo real medido (elevado a BC) es mayor que la energía que REE nos ha liquidado hasta la fecha. Esto significa que en próximos cierres nos facturarán esa diferencia. Los valores "A cobrar" en verde significan que REE nos ha liquidado más energía de la consumida, por lo que nos devolverán la diferencia en futuros cierres.
        </p>
        <p>
          <strong>Importante:</strong> Este cálculo es una estimación. La agregación de la demanda BC y la valoración del coste del desvío y energía se ha calculado hora a hora basándonos en las curvas de carga sumadas por segmento tarifario. Los datos se precalculan cada noche para mejorar el rendimiento de la plataforma.
        </p>
      </div>
    </div>
  );
}
