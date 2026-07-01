'use client';

import { useState } from 'react';
import { Search, Download, BarChart2, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function PreciosClient({ availableComponents = ['OMIE'], monthlyAverages = [] }: { availableComponents?: string[], monthlyAverages?: any[] }) {
  const [loading, setLoading] = useState(false);
  const [component, setComponent] = useState(availableComponents[0] || 'OMIE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    
    try {
      const query = new URLSearchParams({ component, startDate, endDate });
      const res = await fetch(`/api/precios-componentes?${query.toString()}`);
      
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        alert('Error al buscar datos');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyAverage = (values: number[]) => {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  };

  const handleDownloadCSV = () => {
    if (results.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    const quarters = Array.from({length: 96}, (_, i) => `Q${i+1}`);
    csvContent += `Fecha;${quarters.join(';')}\n`;

    // Data rows
    results.forEach(row => {
      const dateStr = format(new Date(row.date), 'dd/MM/yyyy');
      // Format array of 96 floats using Spanish comma decimal
      const formattedValues = row.values.map((v: number) => v.toString().replace('.', ','));
      csvContent += `${dateStr};${formattedValues.join(';')}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `precios_${component}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COMPONENT_LABELS: Record<string, string> = {
    BS3: "Banda Secundaria",
    RAD3: "Reserva Adicional de Potencia",
    RAD1X: "Ajustes 1ª Fase Reserva",
    CT2: "Ajustes PBF",
    CT3: "Ajustes Tiempo Real",
    BALX: "Balance de Energía",
    EXD: "Saldo de Desvíos",
    IN7: "Pagos por Capacidad",
    CFP: "Cuota de Financiación",
    RT3: "Restricciones PBF",
    RT6: "Restricciones en Tiempo Real"
  };

  const getLabel = (comp: string) => {
    return COMPONENT_LABELS[comp] ? `${comp} (${COMPONENT_LABELS[comp]})` : comp;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Visor de Precios
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Consulta y exporta el histórico de precios de los diferentes componentes del sistema.
          </p>
        </div>
        {results.length > 0 && (
          <button
            onClick={handleDownloadCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '8px',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <Download size={18} />
            Descargar CSV (96 Cuartos)
          </button>
        )}
      </div>

      <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Componente</label>
            <select
              value={component}
              onChange={e => setComponent(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)'
              }}
            >
              {availableComponents.map(comp => (
                <option key={comp} value={comp}>
                  {getLabel(comp)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fecha Inicio</label>
            <input
              required
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fecha Fin</label>
            <input
              required
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)'
              }}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', borderRadius: '8px', background: 'var(--lime)',
                border: 'none', color: 'var(--bg-base)', fontWeight: 600, cursor: 'pointer',
                opacity: loading ? 0.7 : 1, height: '42px'
              }}
            >
              <Search size={18} />
              {loading ? 'Buscando...' : 'Consultar'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Buscando precios...</div>
      ) : hasSearched && results.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: '12px' }}>
          No se encontraron datos para este rango de fechas.
        </div>
      ) : results.length > 0 ? (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.1)' }}>
            <BarChart2 size={20} color="var(--lime)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Resumen Diario</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {results.length} días encontrados
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fecha</th>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Valor Mínimo</th>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Media Diaria</th>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Valor Máximo</th>
              </tr>
            </thead>
            <tbody>
              {results.map(row => {
                const values = row.values as number[];
                const min = Math.min(...values);
                const max = Math.max(...values);
                const avg = calculateDailyAverage(values);
                
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={16} color="var(--text-muted)" />
                      {format(new Date(row.date), 'dd/MM/yyyy')}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{min.toFixed(2)} €/MWh</td>
                    <td style={{ padding: '16px 20px', color: 'var(--lime)', fontWeight: 600 }}>{avg.toFixed(2)} €/MWh</td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{max.toFixed(2)} €/MWh</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '8px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--lime)" />
          Información sobre agregaciones del sistema
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
          El sistema agrupa automáticamente los ficheros de liquidación (COMPODEM) de REE para generar dos agregados principales utilizados por el cotizador:
        </p>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: 1.6, marginBottom: 0 }}>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>RESTRICCIONES:</strong> Suma de las restricciones técnicas (<strong>RT3</strong>, <strong>RT6</strong>, <strong>CT2</strong> y <strong>CT3</strong>).
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>OS (Operador del Sistema):</strong> Suma de los componentes relacionados con los servicios de ajuste (<strong>BS3</strong>, <strong>RAD3</strong>, <strong>RAD1</strong>, <strong>RAD1X</strong>, <strong>BALX</strong>, <strong>EXD</strong>, <strong>IN7</strong>, <strong>CFP</strong>, <strong>MI</strong> y <strong>SECX</strong>).
          </li>
        </ul>
      </div>

      {monthlyAverages && monthlyAverages.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.1)' }}>
            <BarChart2 size={20} color="var(--lime)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Promedios Mensuales (Últimos 12 meses)</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mes</th>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Promedio OMIE</th>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Promedio RESTRICCIONES</th>
                <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Promedio OS</th>
              </tr>
            </thead>
            <tbody>
              {monthlyAverages.map((row: any) => (
                <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="var(--text-muted)" />
                    {row.month}
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{row.omie} €/MWh</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{row.restricciones} €/MWh</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{row.os} €/MWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
