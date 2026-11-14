'use client';

import { signOut } from 'next-auth/react';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function BlockedSessionScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldAlert size={24} color="var(--danger)" />
        </div>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Acceso desactivado
        </h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Tu cuenta de usuario ha sido desactivada o ya no dispone de permisos activos en el sistema.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '8px', gap: '8px' }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
