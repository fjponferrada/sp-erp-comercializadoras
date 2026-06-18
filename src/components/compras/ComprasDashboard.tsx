'use client';

import { useState } from 'react';
import { Activity, Zap, Download, RefreshCw, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import Topbar from '@/components/Topbar';

export default function ComprasDashboard({ initialForecasts, activeContracts }: any) {
  const [activeTab, setActiveTab] = useState('prediccion');
  const [loading, setLoading] = useState(false);
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

  const downloadOmieCSV = () => {
    if (!forecastResult) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "FECHA_HORA;DEMANDA_OMIE_MW\\n";
    
    const d = new Date(forecastResult.targetDate);
    
    for(let i=0; i<24; i++) {
      const h = i + 1;
      const mw = (forecastResult.finalPrediction[i] / 1000).toFixed(3);
      csvContent += `${format(d, 'yyyy-MM-dd')} ${h.toString().padStart(2, '0')}:00;${mw}\\n`;
    }
    
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Generador de Predicción Diaria</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Utiliza Random Forest provincial y perfiles VIP SDA (Similar Day Average)</p>
                  </div>
                  <button 
                    onClick={generateForecast}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {loading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                    {loading ? 'Calculando IA...' : 'Generar Predicción Mañana'}
                  </button>
                </div>

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

                    <div style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <tr>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hora</th>
                            <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demanda Resto (MWh)</th>
                            <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Demanda VIP (MWh)</th>
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
