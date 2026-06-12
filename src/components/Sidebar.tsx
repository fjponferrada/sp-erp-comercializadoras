'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useBrandTheme } from '@/context/BrandThemeContext';
import BrandSelector from './BrandSelector';
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
  Settings,
  Building2,
  Sun,
  Tag,
  LogOut,
  FileWarning,
  UploadCloud
} from 'lucide-react';

const baseNavGroups = [
  {
    label: 'Área Personal',
    roles: ['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'],
    items: [
      { href: '/comercializadoras', icon: Building2, label: 'Mis comercializadoras' },
      { href: '/marcas', icon: Tag, label: 'Mis marcas' },
      { href: '/incidencias', icon: AlertCircle, label: 'Incidencias' },
    ],
  },
  {
    label: 'Principal',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' }
    ],
  },
  {
    label: 'CRM Ventas',
    items: [
      { href: '/leads', icon: Users, label: 'Leads' },
      { href: '/contratos', icon: FileText, label: 'Contratos' },
      { href: '/clientes', icon: Building2, label: 'Clientes' },
      { href: '/facturas', icon: Receipt, label: 'Facturas' },
      { href: '/renovaciones', icon: RefreshCcw, label: 'Renovaciones' },
      { href: '/bajas', icon: TrendingDown, label: 'Bajas' },
    ],
  },
  {
    label: 'DISTRIBUIDORAS',
    items: [
      { href: '/importar-switching', icon: UploadCloud, label: 'Importar Switching' },
      { href: '/switching-warnings', icon: AlertCircle, label: 'Eventos Switchings' },
      { href: '/reclamaciones', icon: FileWarning, label: 'Reclamaciones' },
      { href: '/ficheros-f1', icon: FileText, label: 'Ficheros F1' },
    ],
  },
  {
    label: 'Autoconsumo',
    items: [
      { href: '/autoconsumo', icon: Sun, label: 'Autoconsumo' },
    ],
  },
  {
    label: 'Configuración',
    roles: ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'],
    items: [
      { href: '/usuarios', icon: Users, label: 'Usuarios', roles: ['SUPERADMIN', 'COMPANYADMIN'] },
      { href: '/productos', icon: Package, label: 'Productos' },
      { href: '/canales', icon: Share2, label: 'Canales' },
      { href: '/ajustes', icon: Settings, label: 'Ajustes' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const brand = useBrandTheme();
  const { data: session } = useSession();
  
  const userRole = session?.user?.role || 'CANAL';

  const navGroups = baseNavGroups.filter(group => {
    if (!group.roles) return true;
    return group.roles.includes(userRole);
  });

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
        <BrandSelector />
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-section-label">{group.label}</div>
            {group.items.map((item: any) => {
              if (item.roles && !item.roles.includes(userRole)) return null;
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
            {session?.user?.email?.substring(0, 2).toUpperCase() || 'AD'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session?.user?.email?.split('@')[0] || 'Admin'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{userRole}</div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              borderRadius: '6px',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '6px', 
              padding: '6px 10px',
              color: 'var(--danger)',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            title="Cerrar sesión"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </div>
    </aside>
  );
}
