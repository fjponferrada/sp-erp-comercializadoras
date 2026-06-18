'use client';

import { useState, Suspense } from 'react';
import { Zap, EyeOff, Eye, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPasswordAction } from '@/app/actions/authActions';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--danger)', padding: '20px', borderRadius: '12px', marginBottom: '24px'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
            Falta el token de recuperación en la URL.
          </p>
        </div>
        <Link href="/login" style={{
          color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.85rem'
        }}>
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const res = await resetPasswordAction(token, password);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          color: 'var(--lime)', padding: '20px', borderRadius: '12px', marginBottom: '24px'
        }}>
          <CheckCircle2 size={32} style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
            Tu contraseña se ha restablecido correctamente.
          </p>
        </div>
        <Link href="/login" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem'
        }}>
          <ArrowLeft size={16} /> Iniciar sesión ahora
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label className="form-label">Nueva Contraseña</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPass ? 'text' : 'password'}
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
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

      <div>
        <label className="form-label">Confirmar Contraseña</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPass ? 'text' : 'password'}
            className="form-input"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            style={{ paddingRight: '42px' }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{
          width: '100%', justifyContent: 'center', padding: '12px',
          fontSize: '0.9rem', marginTop: '8px',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Guardando...' : 'Restablecer contraseña'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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

      {/* Card */}
      <div className="animate-fade-in-up" style={{
        width: '100%', maxWidth: '420px', margin: '0 20px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: '16px',
        padding: '40px',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        zIndex: 10
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
            Nueva <span style={{ color: 'var(--lime)' }}>Contraseña</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Escribe tu nueva contraseña
          </p>
        </div>

        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>

        {/* Footer */}
        <div style={{
          marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}>
          <ShieldCheck size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Acceso seguro · SP Energía ERP
          </span>
        </div>
      </div>
    </div>
  );
}
