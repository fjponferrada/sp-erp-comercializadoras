'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Zap, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    
    if (res?.error) {
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
      setLoading(false);
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Fondo animado con gradientes */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 50% at 20% -10%, rgba(222,255,154,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 110%, rgba(59,130,246,0.06) 0%, transparent 55%)
        `,
      }} />

      {/* Grid decorativo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        opacity: 0.3,
      }} />

      {/* Card de Login */}
      <div className="animate-fade-in-up" style={{
        width: '100%', maxWidth: '420px', margin: '0 20px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: '16px',
        padding: '40px',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        {/* Borde lima superior */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--lime), transparent)',
          borderRadius: '0 0 2px 2px',
        }} />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', background: 'var(--lime)',
            borderRadius: '12px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 14px',
            boxShadow: '0 0 24px rgba(222,255,154,0.3)',
          }}>
            <Zap size={26} color="var(--bg-base)" strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            SP Energía <span style={{ color: 'var(--lime)' }}>ERP</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Gestión integral de comercializadoras
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Contraseña</label>
              <a href="#" style={{ fontSize: '0.75rem', color: 'var(--lime)', textDecoration: 'none', fontWeight: 500 }}>
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* Botón */}
          <button
            id="btn-login"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%', justifyContent: 'center', padding: '12px',
              fontSize: '0.9rem', marginTop: '4px',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px', height: '16px', border: '2px solid var(--bg-base)',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Accediendo...
              </>
            ) : (
              <><LogIn size={16} /> Acceder al ERP</>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}>
          <ShieldCheck size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Acceso seguro · SP Energía ERP v1.0
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
