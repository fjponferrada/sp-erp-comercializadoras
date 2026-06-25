'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Zap } from 'lucide-react';
import { format } from 'date-fns';
import PpaForm from '@/components/compras/PpaForm';
import LiquidacionesPpa from '@/components/compras/LiquidacionesPpa';

export default function PpaClient() {
  const [ppas, setPpas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'liquidaciones'>('list');

  const fetchPpas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ppas');
      if (res.ok) {
        const data = await res.json();
        setPpas(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPpas();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este PPA?')) return;
    try {
      const res = await fetch(`/api/ppas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPpas();
      } else {
        alert('Error al eliminar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Contratos PPA (Power Purchase Agreements)
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Gestiona los acuerdos de compra de energía físicos y financieros de la comercializadora.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--lime)', color: 'var(--bg-base)',
            border: 'none', padding: '10px 16px', borderRadius: '8px',
            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Plus size={18} />
          Añadir PPA
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{ 
            background: 'none', border: 'none', fontSize: '1rem', fontWeight: activeTab === 'list' ? 600 : 400,
            color: activeTab === 'list' ? 'var(--lime)' : 'var(--text-secondary)', cursor: 'pointer',
            paddingBottom: '8px', borderBottom: activeTab === 'list' ? '2px solid var(--lime)' : '2px solid transparent',
            marginBottom: '-10px'
          }}
        >
          Listado de PPAs
        </button>
        <button 
          onClick={() => setActiveTab('liquidaciones')}
          style={{ 
            background: 'none', border: 'none', fontSize: '1rem', fontWeight: activeTab === 'liquidaciones' ? 600 : 400,
            color: activeTab === 'liquidaciones' ? 'var(--lime)' : 'var(--text-secondary)', cursor: 'pointer',
            paddingBottom: '8px', borderBottom: activeTab === 'liquidaciones' ? '2px solid var(--lime)' : '2px solid transparent',
            marginBottom: '-10px'
          }}
        >
          Liquidaciones PPA
        </button>
      </div>

      {activeTab === 'liquidaciones' && (
        <LiquidacionesPpa />
      )}

      {activeTab === 'list' && (
        <>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando PPAs...</div>
      ) : ppas.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', background: 'var(--bg-elevated)',
          borderRadius: '12px', border: '1px dashed var(--border)'
        }}>
          <FileText size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No hay PPAs configurados</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Añade tu primer contrato PPA Físico o Financiero para que el sistema lo aplique en las liquidaciones y proyecciones.
          </p>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: '12px', overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Nombre</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subtipo</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Vigencia</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Precio</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ppas.map(ppa => (
                <tr key={ppa.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={16} color="var(--lime)" />
                      {ppa.name}
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                      background: ppa.type === 'FISICO' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                      color: ppa.type === 'FISICO' ? '#60A5FA' : '#C084FC'
                    }}>
                      {ppa.type}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {ppa.subtype.replace('_', ' ')}
                    {ppa.subtype === 'CARGA_BASE' && ppa.basePowerMw && ` (${ppa.basePowerMw} MW)`}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {format(new Date(ppa.startDate), 'dd/MM/yyyy')} 
                    {ppa.endDate ? ` - ${format(new Date(ppa.endDate), 'dd/MM/yyyy')}` : ' - Indefinido'}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {ppa.priceType === 'FIJO' ? `${ppa.priceValue} €/MWh` : `OMIE + ${ppa.priceValue} €/MWh`}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(ppa.id)}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--danger)',
                        cursor: 'pointer', padding: '6px', borderRadius: '6px',
                        transition: 'all 0.2s'
                      }}
                      title="Eliminar PPA"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {isFormOpen && (
        <PpaForm 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false);
            fetchPpas();
          }} 
        />
      )}
    </div>
  );
}
