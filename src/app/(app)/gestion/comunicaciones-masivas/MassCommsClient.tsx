'use client';

import React, { useState, useMemo } from 'react';
import { Mail, CheckSquare, Square, Filter, Search } from 'lucide-react';
import MassCommsModal from './MassCommsModal';

type SPData = {
  id: string;
  cups: string;
  status: 'ACTIVO' | 'INACTIVO';
  clientName: string;
  clientEmail: string;
  channelName: string;
  channelId: string;
  contractId: string;
};

export default function MassCommsClient({ initialData }: { initialData: SPData[] }) {
  const [data] = useState<SPData[]>(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVO' | 'INACTIVO'>('ALL');
  
  // Channels multi-select
  const allChannels = useMemo(() => {
    const channelsMap = new Map<string, string>();
    data.forEach(d => channelsMap.set(d.channelId, d.channelName));
    return Array.from(channelsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);
  
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set(allChannels.map(c => c.id)) // All selected by default
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Search term (CUPS or Client Name)
      if (searchTerm && !item.cups.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !item.clientName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // 2. Status
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // 3. Channels
      if (!selectedChannels.has(item.channelId)) {
        return false;
      }
      return true;
    });
  }, [data, searchTerm, statusFilter, selectedChannels]);

  // Checkbox handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set()); // Deselect all currently filtered
    } else {
      setSelectedIds(new Set(filteredData.map(d => d.id))); // Select all filtered
    }
  };

  const handleToggleRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleChannel = (id: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedChannels(newSelected);
  };

  const selectAllChannels = (select: boolean) => {
    if (select) setSelectedChannels(new Set(allChannels.map(c => c.id)));
    else setSelectedChannels(new Set());
  };

  return (
    <div>
      {/* Filtros */}
      <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Buscar (CUPS o Cliente)
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ES000000..."
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div style={{ minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Estado Suministro
            </label>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Filtro de Canales */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Filtrar por Canal
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => selectAllChannels(true)} style={{ fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--lime)', cursor: 'pointer', fontWeight: 600 }}>Seleccionar Todos</button>
              <button onClick={() => selectAllChannels(false)} style={{ fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Ninguno</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {allChannels.map(channel => (
              <button
                key={channel.id}
                onClick={() => toggleChannel(channel.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: `1px solid ${selectedChannels.has(channel.id) ? 'var(--lime)' : 'var(--border)'}`,
                  background: selectedChannels.has(channel.id) ? 'var(--lime-light, rgba(200, 255, 0, 0.1))' : 'var(--bg-base)',
                  color: selectedChannels.has(channel.id) ? 'var(--lime)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: selectedChannels.has(channel.id) ? 600 : 400
                }}
              >
                {channel.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Mostrando {filteredData.length} resultados ({selectedIds.size} seleccionados)
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={selectedIds.size === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: selectedIds.size > 0 ? 'var(--lime)' : 'var(--bg-card)',
            color: selectedIds.size > 0 ? 'var(--bg-base)' : 'var(--text-secondary)',
            border: `1px solid ${selectedIds.size > 0 ? 'transparent' : 'var(--border)'}`,
            padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s'
          }}
        >
          <Mail size={18} />
          Comunicación Masiva
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', width: '40px' }}>
                <button 
                  onClick={handleSelectAll} 
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0, display: 'flex' }}
                >
                  {selectedIds.size > 0 && selectedIds.size === filteredData.length ? <CheckSquare size={18} color="var(--lime)" /> : <Square size={18} />}
                </button>
              </th>
              <th style={{ padding: '12px 16px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>CUPS</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Cliente</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Email</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Canal</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => handleToggleRow(item.id)}>
                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => handleToggleRow(item.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0, display: 'flex' }}
                  >
                    {selectedIds.has(item.id) ? <CheckSquare size={18} color="var(--lime)" /> : <Square size={18} />}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace' }}>{item.cups}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{item.clientName}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{item.clientEmail || '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>{item.channelName}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ 
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    background: item.status === 'ACTIVO' ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 61, 0, 0.1)',
                    color: item.status === 'ACTIVO' ? '#00C853' : '#FF3D00'
                  }}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No hay resultados para los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <MassCommsModal
          onClose={() => setIsModalOpen(false)}
          selectedIds={Array.from(selectedIds)}
          onSuccess={() => {
            setIsModalOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
