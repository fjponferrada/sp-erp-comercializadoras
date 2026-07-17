'use client';

import { useState } from 'react';
import { Activity, Zap, Download, RefreshCw, BarChart2, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Topbar from '@/components/Topbar';

export default function ComprasDashboard({ initialForecasts, activeContracts, lastTrainingDate, projectionData }: any) {
  const [activeTab, setActiveTab] = useState('prediccion');
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [forecastResult, setForecastResult] = useState<any>(null);

  const generateForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compras/forecast', { method: 'POST' });
      if (!res.ok) throw new Error('Error al generar la predicción');
      const data = await res.json();
      setForecastResult(data);
    } catch (error) {
      alert('Error: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    setTraining(true);
    setTrainingProgress(0);
    
    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 95) return 95; 
        return prev + 2; 
      });
    }, 1000);

    try {
      const res = await fetch('/api/cron/train-forecast', { method: 'GET' });
      if (!res.ok) throw new Error('Error al entrenar el modelo');
      setTrainingProgress(100);
    } catch (error) {
      alert('Error: ' + error);
      setTrainingProgress(0);
    } finally {
      clearInterval(interval);
      setTimeout(() => setTraining(false), 1000);
    }
  };

  const downloadOmieCSV = () => {
    if (!forecastResult) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "SEGMENTO;" + Array.from({length: 96}, (_, i) => `Q${i+1}`).join(";") + "\n";
    
    if (forecastResult.segmentBreakdown) {
      const segments = ['HOGAR 0-5kW', 'HOGAR 5-10kW', 'HOGAR 10-15kW', 'PYME <50 MWh', 'PYME >50 MWh', 'VE <15 MWh', 'VE >15 MWh', 'VIP'];
      for (const seg of segments) {
        const data = forecastResult.segmentBreakdown[seg];
        if (data) {
          csvContent += `${seg}`;
          for(let i=0; i<24; i++) {
            const mw = (data[i] / 1000).toFixed(3).replace('.', ',');
            // Repetimos la potencia horaria en los 4 cuartos
            for(let q=0; q<4; q++) csvContent += `;${mw}`;
          }
          csvContent += "\n";
        }
      }
    }
    
    // Suavizado (Interpolación Lineal) para OMIE
    const xHours = Array.from({length: 24}, (_, i) => i + 0.5);
    const yPotencia = forecastResult.finalPrediction.map((p: number) => p / 1000);
    const xCuartos = Array.from({length: 96}, (_, i) => i * 0.25);
    
    const smoothPower = xCuartos.map(xq => {
      if (xq <= xHours[0]) return yPotencia[0];
      if (xq >= xHours[23]) return yPotencia[23];
      let i = 0;
      while (xHours[i+1] < xq) i++;
      const x0 = xHours[i]; const x1 = xHours[i+1];
      const y0 = yPotencia[i]; const y1 = yPotencia[i+1];
      return y0 + (xq - x0) * (y1 - y0) / (x1 - x0);
    });

    const d = new Date(forecastResult.targetDate);
    csvContent += `TOTAL_OMIE_${format(d, 'dd/MM/yyyy')}`;
    
    for(let i=0; i<96; i++) {
      // Redondeamos a 1 decimal como requería OMIE_MW_lineal
      const mw = smoothPower[i].toFixed(1).replace('.', ',');
      csvContent += `;${mw}`;
    }
    csvContent += "\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prediccion_OMIE_${forecastResult.targetDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Topbar title="Compras de Energía" subtitle="Módulo avanzado de predicción de demanda con IA y geolocalización provincial." showSearch={false} />

      <div style={{ padding: '28px 28px 48px' }}>
        <div className="card animate-fade-in-up" style={{ padding: 0 }}>
          <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '24px' }}>
            <button
              onClick={() => setActiveTab('auditoria')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 4px', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                color: activeTab === 'auditoria' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'auditoria' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Activity size={16} />
              Auditoría de Datos
            </button>
            <button
              onClick={() => setActiveTab('prediccion')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 4px', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
                color: activeTab === 'prediccion' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'prediccion' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Zap size={16} />
              Predicción IA
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {activeTab === 'auditoria' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="card-stat">
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contratos Activos</span>
                    <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>{activeContracts}</div>
                  </div>
                  <div className="card-stat">
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Zonas Climáticas</span>
                    <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>52</div>
                  </div>
                  <div className="card-stat">
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>Estado del Modelo</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '8px' }}>Entrenado</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prediccion' && (
              <div className="space-y-8">
                
                <div style={{ background: 'var(--bg-elevated)', padding: '16px 20px', borderRadius: '8px', borderLeft: '4px solid var(--primary)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                  <p><strong>Nota sobre el Entrenamiento:</strong> No es necesario entrenar el modelo más de una vez al día. La IA aprende de los históricos de demanda, por lo que incluso entrenándolo <strong>una vez por semana</strong> sería suficiente para mantener una alta precisión.</p>
                  {lastTrainingDate && (
                    <div style={{ background: 'var(--bg-base)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Último Entrenamiento</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{format(new Date(lastTrainingDate), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Generador de Predicción Diaria</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Utiliza Árboles de Decisión provinciales y perfiles VIP SDA (Similar Day Average)</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={trainModel}
                      disabled={training || loading}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      title="Sincroniza los últimos 30 días de agregados y entrena el modelo"
                    >
                      {training ? <RefreshCw className="animate-spin" size={16} /> : <Brain size={16} />}
                      {training ? 'Sincronizando y Entrenando...' : 'Sincronizar y Entrenar'}
                    </button>
                    <button 
                      onClick={generateForecast}
                      disabled={loading || training}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {loading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                      {loading ? 'Calculando IA...' : 'Generar Predicción Mañana'}
                    </button>
                    
                    <button 
                      onClick={async () => {
                        if (!confirm('Esto regenerará el histórico completo de los últimos 365 días. Puede tardar un par de minutos. ¿Continuar?')) return;
                        try {
                          alert('La sincronización profunda se ha iniciado. Esto puede tardar varios minutos en segundo plano.');
                          await fetch('/api/cron/aggregate-history?days=365');
                          alert('Sincronización profunda completada con éxito.');
                        } catch (e) {
                          alert('Hubo un error al sincronizar. Es posible que el proceso haya excedido el tiempo límite de Vercel, pero seguirá en segundo plano si usas un servidor propio.');
                        }
                      }}
                      disabled={training || loading}
                      className="btn btn-outline"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}
                      title="Forzar cálculo de los últimos 365 días (Solo usar tras importar ZIPs antiguos)"
                    >
                      <RefreshCw size={16} />
                      Sincronización Profunda
                    </button>
                  </div>
                </div>

                {projectionData && projectionData.length > 0 && (
                  <div className="animate-fade-in-up" style={{ marginTop: '24px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Proyección de Consumo a 12 Meses (Cartera Actual)</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-base)', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Concepto</th>
                            {projectionData.map((p: any, i: number) => (
                              <th key={i} style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.monthName}</th>
                            ))}
                            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', transition: 'background 0.2s' }} className="hover:bg-gray-50/5 dark:hover:bg-white/5">
                            <td style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>Consumo Estimado (MWh)</td>
                            {projectionData.map((p: any, i: number) => (
                              <td key={i} style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{p.mwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</td>
                            ))}
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                              {projectionData.reduce((acc: number, p: any) => acc + p.mwh, 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                          <tr style={{ background: 'var(--bg-elevated)', transition: 'background 0.2s' }} className="hover:bg-gray-50/5 dark:hover:bg-white/5">
                            <td style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>% sobre Total 12m</td>
                            {projectionData.map((p: any, i: number) => (
                              <td key={i} style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{p.percentage.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</td>
                            ))}
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                              {Math.round(projectionData.reduce((acc: number, p: any) => acc + p.percentage, 0))}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {training && (
                  <div className="animate-fade-in-up" style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-primary)' }}>Entrenando Inteligencia Artificial...</span>
                      <span style={{ color: 'var(--primary)' }}>{trainingProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--gray-alpha-100)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${trainingProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.5s ease-out' }} />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                      Procesando miles de registros históricos. Esto puede tardar alrededor de un minuto.
                    </p>
                  </div>
                )}

                {forecastResult && (
                  <div className="animate-fade-in-up space-y-6">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Resultados: {forecastResult.targetDate}
                      </h4>
                      <button 
                        onClick={downloadOmieCSV}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download size={16} />
                        Exportar CSV OMIE
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="card-stat">
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Energía a Comprar</span>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '8px' }}>
                          {(forecastResult.totalPredicted / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>MWh</span>
                        </div>
                      </div>
                      <div className="card-stat">
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volumen VIP Automatizado (SDA)</span>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--success)', marginTop: '8px' }}>
                          {(forecastResult.vipPredictions.reduce((a:number,b:number)=>a+b,0) / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>MWh</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'flex-start' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Curva de Demanda</h4>
                      </div>
                      <div style={{ width: '100%', maxWidth: '850px', height: 400 }}>
                        <ResponsiveContainer>
                          <LineChart 
                            data={forecastResult.finalPrediction.map((val: number, i: number) => ({
                              hora: `${String(i + 1).padStart(2, '0')}:00`,
                              'Resto (IA)': parseFloat(((val - forecastResult.vipPredictions[i]) / 1000).toFixed(3)),
                              'VIP/VE (SDA)': parseFloat((forecastResult.vipPredictions[i] / 1000).toFixed(3)),
                              'Total OMIE': parseFloat((val / 1000).toFixed(3))
                            }))} 
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="hora" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis 
                              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]} 
                              stroke="var(--text-muted)" 
                              fontSize={12} 
                              tickLine={false} 
                              axisLine={false} 
                              tickFormatter={(val) => `${val} MW`} 
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                              itemStyle={{ color: 'var(--text-primary)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line type="monotone" dataKey="Total OMIE" stroke="#3b82f6" strokeWidth={4} dot={false} />
                            <Line type="monotone" dataKey="Resto (IA)" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="VIP/VE (SDA)" stroke="var(--success)" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <tr>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hora</th>
                            <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demanda Resto (MWh) - Cálculo IA</th>
                            <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demanda VIP/VE (MWh) - Cálculo SDA</th>
                            <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>TOTAL OMIE (MWh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastResult.finalPrediction.map((val: number, i: number) => {
                            const vip = forecastResult.vipPredictions[i];
                            const resto = val - vip;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px 20px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{String(i + 1).padStart(2, '0')}:00</td>
                                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>{(resto / 1000).toFixed(3)}</td>
                                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--success)', textAlign: 'right', fontWeight: 500 }}>{(vip / 1000).toFixed(3)}</td>
                                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--primary)', textAlign: 'right', fontWeight: 800 }}>{(val / 1000).toFixed(3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong>ℹ️ Nota sobre los métodos de cálculo:</strong><br />
                      Tanto los Puntos de Suministro asociados a <strong>Vehículos Eléctricos (VE)</strong> como los CUPS clasificados como <strong>VIP</strong> (consumo superior a 100 MWh/año) son estimados mediante el algoritmo <strong>SDA (Similar Day Average)</strong>, ya que su perfil de demanda responde a rutinas estables y no presenta correlación fuerte con la temperatura exterior. El resto de la cartera se estima mediante Machine Learning (IA) basado en previsión meteorológica provincial.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
