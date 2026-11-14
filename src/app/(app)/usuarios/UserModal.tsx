'use client';

import React, { useState, useMemo } from 'react';
import { X, Save, ShieldAlert, Eye, EyeOff, ShieldCheck, Info } from 'lucide-react';

const ROOT_SUPERADMIN_EMAIL = 'fjponferrada@sp-energia.com';

export default function UserModal({
  user,
  brands,
  companies,
  channels,
  currentUserRole,
  currentUserId,
  onClose,
  onSaved,
}: any) {
  const isSuperAdminCaller = currentUserRole === 'SUPERADMIN';
  const isEditingSelf = Boolean(user?.id && user.id === currentUserId);
  const isRootSuperadmin = Boolean(
    user?.email && user.email.trim().toLowerCase() === ROOT_SUPERADMIN_EMAIL
  );
  const lockRoleAndActive = isEditingSelf || isRootSuperadmin;

  // Pre-hidratar empresas incluyendo también las empresas padre de assignedBrands (para usuarios migrados por backfill)
  const initialCompanyIds = useMemo(() => {
    const fromCompanies = user?.companies?.map((c: any) => c.id) || [];
    const fromAssignedBrands =
      user?.assignedBrands?.map((b: any) => b.companyId).filter(Boolean) || [];
    return Array.from(new Set([...fromCompanies, ...fromAssignedBrands]));
  }, [user]);

  const initialBrandIds = useMemo(() => {
    return user?.assignedBrands?.map((b: any) => b.id) || [];
  }, [user]);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'COMERCIAL',
    isActive: user?.isActive ?? true,
    brandId: user?.brandId || brands?.[0]?.id || '',
    assignedCompanyIds: initialCompanyIds,
    assignedBrandIds: initialBrandIds,
    channelId: user?.channelId || '',
    phone: user?.phone || '',
    codigo: user?.codigo || '',
    isChannelSupervisor: user?.isChannelSupervisor || false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'role') {
      const nextRole = value;
      const keepsChannel = nextRole === 'CANAL' || nextRole === 'COMERCIAL';
      setFormData((prev) => ({
        ...prev,
        role: nextRole,
        channelId: keepsChannel ? prev.channelId : '',
        isChannelSupervisor:
          nextRole === 'CANAL'
            ? true
            : nextRole === 'COMERCIAL'
              ? prev.isChannelSupervisor
              : false,
      }));
      return;
    }

    if (name === 'channelId') {
      setFormData((prev) => ({
        ...prev,
        channelId: value,
        isChannelSupervisor: value ? (prev.role === 'CANAL' ? true : prev.isChannelSupervisor) : false,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const selectedChannel = useMemo(
    () => channels?.find((c: any) => c.id === formData.channelId) || null,
    [channels, formData.channelId]
  );

  const handleSave = async () => {
    setLoading(true);
    setError('');

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPassword = formData.password.trim();

    if (!cleanName || !cleanEmail) {
      setError('El nombre completo y el correo electrónico son obligatorios.');
      setLoading(false);
      return;
    }

    if (!user && cleanPassword.length < 8) {
      setError('La contraseña de acceso es obligatoria y debe tener al menos 8 caracteres.');
      setLoading(false);
      return;
    }

    if (user && cleanPassword !== '' && cleanPassword.length < 8) {
      setError('Si deseas cambiar la contraseña, debe tener al menos 8 caracteres.');
      setLoading(false);
      return;
    }

    if (formData.role === 'CANAL' && !formData.channelId) {
      setError('El rol Jefe de Canal requiere seleccionar obligatoriamente un Canal de Ventas.');
      setLoading(false);
      return;
    }

    if (formData.role === 'CLIENT' && !formData.brandId) {
      setError('Debes seleccionar la marca a la que pertenece el cliente.');
      setLoading(false);
      return;
    }

    if (formData.role === 'BACKOFFICE' && formData.assignedBrandIds.length === 0) {
      setError('El rol Backoffice requiere marcar al menos una Marca Autorizada.');
      setLoading(false);
      return;
    }

    if (
      formData.role === 'COMPANYADMIN' &&
      formData.assignedCompanyIds.length === 0 &&
      formData.assignedBrandIds.length === 0
    ) {
      setError('El Responsable de Empresa requiere marcar al menos una Comercializadora.');
      setLoading(false);
      return;
    }

    if (
      formData.role === 'COMERCIAL' &&
      !formData.channelId &&
      !user &&
      formData.assignedBrandIds.length === 0
    ) {
      setError('Selecciona un Canal de Ventas o al menos una Marca Autorizada para el nuevo comercial.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(user ? `/api/users/${user.id}` : '/api/users', {
        method: user ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar el usuario');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showCompanyBrandSelector =
    formData.role === 'COMPANYADMIN' ||
    formData.role === 'BACKOFFICE' ||
    (formData.role === 'COMERCIAL' && !formData.channelId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              {user ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {user ? `ID: ${user.email}` : 'Configura credenciales, rol y alcance multi-marca'}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.83rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Nombre Completo
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%' }}
                placeholder="Ej. Pablo Remacha"
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Correo Electrónico
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isRootSuperadmin}
                className="form-input"
                style={{ width: '100%', opacity: isRootSuperadmin ? 0.65 : 1 }}
                placeholder="ejemplo@aedenergia.es"
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Contraseña{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.76rem' }}>
                {user ? '(Dejar en blanco para mantener la actual · mín. 8 caracteres)' : '(Mínimo 8 caracteres)'}
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%', paddingRight: '40px' }}
                placeholder={user ? 'Nueva contraseña...' : 'Contraseña de acceso...'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Rol de Sistema
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={lockRoleAndActive}
                className="form-input"
                style={{ width: '100%', opacity: lockRoleAndActive ? 0.65 : 1 }}
              >
                <option value="COMERCIAL">Comercial</option>
                <option value="CANAL">Jefe de Canal</option>
                <option value="BACKOFFICE">Backoffice</option>
                <option value="COMPANYADMIN">Responsable Empresa</option>
                {isSuperAdminCaller && <option value="SUPERADMIN">Superadmin</option>}
                <option value="CLIENT">Cliente (Portal)</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Teléfono
              </label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%' }}
                placeholder="+34..."
              />
            </div>

            {formData.role !== 'CLIENT' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  Código (p.ej. MP)
                </label>
                <input
                  name="codigo"
                  value={formData.codigo}
                  onChange={handleChange}
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="Código comercial..."
                />
              </div>
            )}
          </div>

          {/* Estado Activo / Bloqueado */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Acceso al Sistema
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {lockRoleAndActive
                  ? isRootSuperadmin
                    ? 'El Superadmin raíz permanece siempre activo y protegido.'
                    : 'No puedes cambiar el rol ni desactivar tu propia cuenta.'
                  : formData.isActive
                    ? 'El usuario puede iniciar sesión con normalidad.'
                    : 'Acceso bloqueado: no podrá iniciar sesión ni operar.'}
              </div>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: lockRoleAndActive ? 'not-allowed' : 'pointer',
                opacity: lockRoleAndActive ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              <input
                type="checkbox"
                checked={formData.isActive}
                disabled={lockRoleAndActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span
                className={`badge ${formData.isActive ? 'badge-active' : 'badge-danger'}`}
                style={{ fontSize: '0.72rem' }}
              >
                {formData.isActive ? 'Activo' : 'Bloqueado'}
              </span>
            </label>
          </div>

          {/* Sección específica según Rol */}
          {formData.role === 'SUPERADMIN' && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(222, 255, 154, 0.08)',
                border: '1px solid rgba(222, 255, 154, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
              }}
            >
              <ShieldCheck size={18} color="var(--lime)" style={{ flexShrink: 0 }} />
              <span>
                El rol <strong>Superadmin</strong> tiene acceso global automático a todas las
                comercializadoras y marcas del ERP sin necesidad de selección manual.
              </span>
            </div>
          )}

          {formData.role === 'CLIENT' && (
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Marca del Cliente (Portal Área Privada)
              </label>
              <select
                name="brandId"
                value={formData.brandId}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">Selecciona una marca...</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <p style={{ margin: '6px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                El cliente solo verá en su portal los contratos y facturas asociados a su correo dentro de esta marca.
              </p>
            </div>
          )}

          {(formData.role === 'CANAL' || formData.role === 'COMERCIAL') && (
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Canal de Ventas {formData.role === 'CANAL' ? '(Obligatorio)' : '(Opcional)'}
              </label>
              <select
                name="channelId"
                value={formData.channelId}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">
                  {formData.role === 'CANAL'
                    ? 'Selecciona un canal...'
                    : 'Sin canal específico (Comercial directo)'}
                </option>
                {channels.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {brands.length > 1 && c.brand?.name ? ` · (${c.brand.name})` : ''}
                  </option>
                ))}
              </select>

              {formData.channelId && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.83rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="isChannelSupervisor"
                      checked={formData.isChannelSupervisor}
                      onChange={(e) =>
                        setFormData({ ...formData, isChannelSupervisor: e.target.checked })
                      }
                    />
                    Este usuario es Supervisor del Canal
                  </label>

                  {selectedChannel?.brand?.name && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Info size={13} color="var(--lime)" />
                      Heredará automáticamente el acceso a la marca{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {selectedChannel.brand.name}
                      </strong>
                      .
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showCompanyBrandSelector && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {formData.role === 'COMPANYADMIN' && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Info size={13} color="var(--lime)" style={{ flexShrink: 0 }} />
                  Al autorizar una comercializadora, el Responsable de Empresa tendrá acceso automático a todas sus marcas.
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Comercializadoras Autorizadas
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      background: 'var(--bg-elevated)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {companies.map((c: any) => (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.assignedCompanyIds.includes(c.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const newCompanyIds = checked
                              ? [...formData.assignedCompanyIds, c.id]
                              : formData.assignedCompanyIds.filter((id: string) => id !== c.id);

                            const companyBrandIds = c.brands?.map((b: any) => b.id) || [];
                            let newBrandIds = formData.assignedBrandIds;

                            if (!checked) {
                              newBrandIds = formData.assignedBrandIds.filter(
                                (id: string) => !companyBrandIds.includes(id)
                              );
                            } else if (companyBrandIds.length === 1) {
                              // Si la comercializadora solo tiene 1 marca, la pre-marcamos por comodidad
                              newBrandIds = Array.from(
                                new Set([...formData.assignedBrandIds, companyBrandIds[0]])
                              );
                            }

                            setFormData({
                              ...formData,
                              assignedCompanyIds: newCompanyIds,
                              assignedBrandIds: newBrandIds,
                            });
                          }}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Marcas Autorizadas
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      background: 'var(--bg-elevated)',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {formData.assignedCompanyIds.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Selecciona una comercializadora primero
                      </span>
                    ) : (
                      brands
                        .filter((b: any) => formData.assignedCompanyIds.includes(b.companyId))
                        .map((b: any) => (
                          <label
                            key={b.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.8rem',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formData.assignedBrandIds.includes(b.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    assignedBrandIds: [...formData.assignedBrandIds, b.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    assignedBrandIds: formData.assignedBrandIds.filter(
                                      (id: string) => id !== b.id
                                    ),
                                  });
                                }
                              }}
                            />
                            {b.name}
                          </label>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--bg-elevated)',
            flexShrink: 0,
          }}
        >
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={16} />
            {loading ? 'Guardando...' : 'Guardar Usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}
