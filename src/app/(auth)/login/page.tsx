'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Zap, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useBrandTheme } from '@/context/BrandThemeContext';

import { registerClientUserAction } from '@/app/actions/authActions';

export default function LoginPage() {
  const brand = useBrandTheme();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('register') === 'true') {
        setIsRegistering(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    if (isRegistering) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        setLoading(false);
        return;
      }
      
      const res = await registerClientUserAction(name, email, password);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        setSuccessMsg('¡Registro completado con éxito! Ya puedes iniciar sesión.');
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
        setLoading(false);
      }
    } else {
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
          radial-gradient(ellipse 80% 50% at 20% -10%, color-mix(in srgb, var(--lime) 7%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 110%, color-mix(in srgb, var(--lime) 6%, transparent) 0%, transparent 55%)
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
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} style={{ height: '52px', margin: '0 auto 14px', objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: '52px', height: '52px', background: 'var(--lime)',
              borderRadius: '12px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 14px',
              boxShadow: '0 0 24px rgba(222,255,154,0.3)',
            }}>
              <Zap size={26} color="var(--bg-base)" strokeWidth={2.5} />
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {brand.name}
          </h1>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegistering && (
            <div>
              <label className="form-label">Nombre completo</label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="Juan Pérez"
                value={name}
                onChange={e => setName(e.target.value)}
                required={isRegistering}
              />
            </div>
          )}

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
              <a href="/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--lime)', textDecoration: 'none', fontWeight: 500 }}>
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
                autoComplete={isRegistering ? "new-password" : "current-password"}
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

          {isRegistering && (
            <div>
              <label className="form-label" style={{ margin: 0 }}>Confirmar Contraseña</label>
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <input
                  id="confirmPassword"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required={isRegistering}
                  autoComplete="new-password"
                  style={{ paddingRight: '42px' }}
                />
              </div>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500,
            }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              color: 'var(--lime)', fontSize: '0.8rem', fontWeight: 500,
            }}>
              {successMsg}
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
                {isRegistering ? 'Registrando...' : 'Accediendo...'}
              </>
            ) : (
              isRegistering ? <><ShieldCheck size={16} /> Crear cuenta</> : <><LogIn size={16} /> Acceder al ERP</>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccessMsg('');
            }}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {isRegistering ? '¿Ya tienes cuenta? Iniciar sesión' : '¿Eres cliente y no tienes cuenta? Regístrate'}
          </button>
        </div>

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
