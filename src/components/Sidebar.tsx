'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useBrandTheme } from '@/context/BrandThemeContext';
import {
  LayoutDashboard,
  Zap,
  Users,
  FileText,
  Receipt,
  RefreshCcw,
  TrendingDown,
  Package,
  Share2,
  AlertCircle,
  BarChart3,
  Settings,
  ChevronDown,
  Building2,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/analisis', icon: BarChart3, label: 'Análisis Económico' },
    ],
  },
  {
    label: 'CRM Ventas',
    items: [
      { href: '/oportunidades', icon: Zap, label: 'Oportunidades' },
      { href: '/leads', icon: Users, label: 'Leads' },
      { href: '/contratos', icon: FileText, label: 'Contratos' },
      { href: '/clientes', icon: Building2, label: 'Clientes' },
    ],
  },
  {
    label: 'Facturación',
    items: [
      { href: '/facturas', icon: Receipt, label: 'Facturas' },
      { href: '/renovaciones', icon: RefreshCcw, label: 'Renovaciones' },
      { href: '/bajas', icon: TrendingDown, label: 'Bajas' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '/productos', icon: Package, label: 'Productos' },
      { href: '/canales', icon: Share2, label: 'Canales' },
      { href: '/incidencias', icon: AlertCircle, label: 'Incidencias' },
      { href: '/ajustes', icon: Settings, label: 'Ajustes' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const brand = useBrandTheme();

  return (
    <aside className="sidebar">
      {/* Logo / Marca */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Logo dinámico: imagen si existe, icono ⚡ si no */}
          {brand.logoUrl ? (
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              width={36} height={36}
              style={{ borderRadius: '8px', objectFit: 'contain' }}
            />
          ) : (
            <div style={{
              width: '36px', height: '36px',
              background: 'var(--lime)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={20} color="var(--bg-base)" strokeWidth={2.5} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {brand.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              ERP Comercializadoras
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Comercializadora / Marca */}
      <div style={{ padding: '12px 8px' }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
          color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 500,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="lime-dot" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>AED Energía</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Marca: AED Energía</div>
            </div>
          </div>
          <ChevronDown size={14} color="var(--text-muted)" />
        </button>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-section-label">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={16} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer del Sidebar */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px', borderRadius: '8px',
          background: 'var(--bg-elevated)',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700, color: 'var(--bg-base)', flexShrink: 0,
          }}>
            AD
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admin
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Superadmin</div>
          </div>
          <Settings size={14} color="var(--text-muted)" style={{ cursor: 'pointer', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
