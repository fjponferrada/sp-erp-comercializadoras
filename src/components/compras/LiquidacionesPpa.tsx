'use client';

import { useState, useEffect } from 'react';
import { Download, Calculator, Zap, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function LiquidacionesPpa() {
  const [ppas, setPpas] = useState<any[]>([]);
  const [selectedPpa, setSelectedPpa] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/ppas')
      .then(res => res.json())
      .then(data => setPpas(data))
      .catch(err => console.error(err));
      
    // Default to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(format(firstDay, 'yyyy-MM-dd'));
    setEndDate(format(lastDay, 'yyyy-MM-dd'));
  }, []);

  const handleCalcular = async () => {
    if (!selectedPpa || !startDate || !endDate) {
      setError('Por favor completa todos los campos');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const res = await fetch('/api/ppas/liquidaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ppaId: selectedPpa, startDate, endDate })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular liquidación');
      
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result || !result.details) return;
    
    let csv = 'Fecha_Hora;OMIE_Eur_MWh;Volumen_MWh;Precio_Aplicado;Liquidacion_Eur\n';
    result.details.forEach((row: any) => {
      // Formato para que Excel lo entienda fácilmente
      const fechaLocal = format(new Date(row.datetime), 'yyyy-MM-dd HH:mm');
      csv += `${fechaLocal};${row.omie.toString().replace('.', ',')};${row.mwh.toString().replace('.', ',')};${row.appliedPrice.toString().replace('.', ',')};${row.liquidacionEur.toString().replace('.', ',')}\n`;
    });
    
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Liquidacion_PPA_${startDate}_al_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calculator size={20} color="var(--lime)" />
        Motor de Liquidaciones PPA
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Seleccionar PPA</label>
          <select 
            value={selectedPpa} 
            onChange={e => setSelectedPpa(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">-- Elige un PPA --</option>
            {ppas.map(ppa => (
              <option key={ppa.id} value={ppa.id}>{ppa.name} ({ppa.type})</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fecha Desde</label>
          <input 
            type="date" 
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fecha Hasta</label>
          <input 
            type="date" 
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>
      
      {error && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      
      <button
        onClick={handleCalcular}
        disabled={loading}
        style={{
          background: 'var(--lime)', color: 'var(--bg-base)', border: 'none', padding: '12px 24px', 
          borderRadius: '8px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', transition: 'all 0.2s', width: '100%'
        }}
      >
        {loading ? 'Calculando...' : 'Calcular Liquidación'}
      </button>

      {result && result.summary && (
        <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Resumen de Liquidación</h4>
            <button
              onClick={handleDownload}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border)', 
                padding: '8px 16px', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Download size={16} />
              Descargar CSV Detallado
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-base)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <Zap size={18} />
                <span>Energía Producida</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {result.summary.totalMwh.toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>MWh</span>
              </div>
            </div>
            
            <div style={{ background: 'var(--bg-base)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <TrendingUp size={18} />
                <span>Precio Medio OMIE PPA</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {result.summary.omieMedioPpa.toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>€/MWh</span>
              </div>
            </div>
            
            <div style={{ 
              background: result.summary.isFijo ? (result.summary.totalEur > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)') : 'rgba(34, 197, 94, 0.05)', 
              padding: '20px', borderRadius: '12px', 
              border: `1px solid ${result.summary.isFijo ? (result.summary.totalEur > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)') : 'rgba(34, 197, 94, 0.3)'}` 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: result.summary.isFijo ? (result.summary.totalEur > 0 ? '#EF4444' : '#22C55E') : '#22C55E', marginBottom: '8px', fontWeight: 600 }}>
                <span>{result.summary.isFijo ? (result.summary.totalEur > 0 ? 'A favor de Comercializadora (CfD)' : 'A favor del Productor (CfD)') : 'Neto a Pagar al Productor'}</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: result.summary.isFijo ? (result.summary.totalEur > 0 ? '#EF4444' : '#22C55E') : '#22C55E' }}>
                {Math.abs(result.summary.totalEur).toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', opacity: 0.8 }}>€</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
