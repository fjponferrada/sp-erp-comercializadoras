'use client';

import { Bell, Search, Plus, Menu } from 'lucide-react';
import BrandSelector from './BrandSelector';
import { useMobileSidebar } from '@/context/MobileSidebarContext';

interface TopbarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  customActions?: React.ReactNode;
  showSearch?: boolean;
}

export default function Topbar({ title, subtitle, action, customActions, showSearch = false }: TopbarProps) {
  const { setIsOpen } = useMobileSidebar();

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <button 
          className="md:hidden flex-shrink-0"
          onClick={() => setIsOpen(true)}
          style={{ 
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px',
            color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <Menu size={24} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="hidden md:block" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Buscar CUPS, cliente, contrato..."
            style={{ paddingLeft: '32px', padding: '7px 12px 7px 32px', fontSize: '0.8rem' }}
          />
        </div>
      )}

      {/* Notifications */}
      <button style={{
        position: 'relative', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center',
      }}>
        <Bell size={16} color="var(--text-secondary)" />
      </button>

      {/* Actions */}
      <div className="flex gap-3 items-center shrink min-w-0">
        <BrandSelector />
        {customActions}
        {action && (
          <button className="btn-primary" onClick={action.onClick}>
            <Plus size={14} strokeWidth={2.5} />
            {action.label}
          </button>
        )}
      </div>
    </header>
  );
}
