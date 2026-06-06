'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { useBrandTheme } from '@/context/BrandThemeContext';
import { Save, Upload, Building2, Palette, Shield, Bell, Database, CheckCircle2 } from 'lucide-react';

const ajustesSections = ['Marca & Identidad', 'Seguridad', 'Notificaciones', 'Integraciones'];

export default function AjustesPage() {
  const brand = useBrandTheme();
  const [activeSection, setActiveSection] = useState('Marca & Identidad');
  const [saved, setSaved] = useState(false);

  // Estado local del formulario de marca
  const [brandName, setBrandName]       = useState(brand.name);
  const [accentColor, setAccentColor]   = useState(brand.accentColor);
  const [bgColor, setBgColor]           = useState(brand.bgColor);
  const [surfaceColor, setSurfaceColor] = useState(brand.surfaceColor);
  const [borderColor, setBorderColor]   = useState(brand.borderColor);

  const handleSave = () => {
    // Aquí se llamará a la API para guardar en la BD y recargar el contexto
    // Por ahora, aplicamos en tiempo real inyectando las variables CSS
    document.documentElement.style.setProperty('--lime', accentColor);
    document.documentElement.style.setProperty('--bg-base', bgColor);
    document.documentElement.style.setProperty('--bg-surface', surfaceColor);
    document.documentElement.style.setProperty('--border', borderColor);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const presets = [
    { name: 'SP Energía (Lima)',  accent: '#DEFF9A', bg: '#0B0F19', surface: '#111827', border: '#1E2A3A' },
    { name: 'Azul Corporativo',   accent: '#60A5FA', bg: '#0A0F1E', surface: '#0F1629', border: '#1E2D4A' },
    { name: 'Naranja Energía',    accent: '#FB923C', bg: '#0F0A06', surface: '#1A1208', border: '#2A1E0E' },
    { name: 'Verde Solar',        accent: '#4ADE80', bg: '#061209', surface: '#0C1F10', border: '#152B1A' },
    { name: 'Púrpura Premium',    accent: '#A78BFA', bg: '#0C0A1A', surface: '#130F24', border: '#1F1835' },
    { name: 'Rojo Eléctrico',     accent: '#F87171', bg: '#130808', surface: '#1F0D0D', border: '#301515' },
  ];

  return (
    <>
      <Topbar title="Ajustes" subtitle="Configuración de la marca y del sistema" />

      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* Menú lateral de secciones */}
        <div className="card" style={{ padding: '8px' }}>
          {ajustesSections.map((s, i) => {
            const icons = [Palette, Shield, Bell, Database];
            const Icon = icons[i];
            return (
              <button key={s} onClick={() => setActiveSection(s)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeSection === s ? 'var(--lime)' : 'transparent',
                color: activeSection === s ? 'var(--bg-base)' : 'var(--text-secondary)',
                fontWeight: activeSection === s ? 700 : 500, fontSize: '0.85rem',
                transition: 'all 0.2s', textAlign: 'left', marginBottom: '2px',
              }}>
                <Icon size={15} />
                {s}
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        <div>
          {activeSection === 'Marca & Identidad' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Logo y nombre */}
              <div className="card animate-fade-in-up">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <Building2 size={16} color="var(--lime)" />
                  <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Identidad de Marca</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Nombre de la Marca</label>
                    <input className="form-input" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="ej. AED Energía" />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>Aparece en el menú lateral y en los emails enviados.</p>
                  </div>
                  <div>
                    <label className="form-label">Logotipo</label>
                    <div style={{
                      border: '2px dashed var(--border-strong)', borderRadius: '8px', padding: '20px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      cursor: 'pointer', transition: 'border-color 0.2s',
                    }}>
                      <Upload size={20} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>PNG, SVG · máx. 512 KB</span>
                      <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '5px 12px' }}>Subir logo</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Presets */}
              <div className="card animate-fade-in-up delay-100">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Palette size={16} color="var(--lime)" />
                  <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Paleta de Colores</h2>
                </div>

                {/* Temas predefinidos */}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Temas predefinidos (clic para aplicar):</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                  {presets.map(preset => (
                    <button key={preset.name} onClick={() => { setAccentColor(preset.accent); setBgColor(preset.bg); setSurfaceColor(preset.surface); setBorderColor(preset.border); }} style={{
                      border: accentColor === preset.accent ? `2px solid ${preset.accent}` : '2px solid var(--border)',
                      borderRadius: '10px', padding: '10px', cursor: 'pointer', background: preset.bg,
                      transition: 'all 0.2s', textAlign: 'left',
                    }}>
                      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: preset.accent }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: preset.surface }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: preset.border }} />
                      </div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: preset.accent }}>{preset.name}</div>
                    </button>
                  ))}
                </div>

                {/* Selectores manuales */}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>O personaliza cada color:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {[
                    { label: '1. Color Acento',      desc: 'Botones, badges, highlights',  value: accentColor,   onChange: setAccentColor },
                    { label: '2. Fondo Principal',    desc: 'Color base de toda la app',    value: bgColor,       onChange: setBgColor },
                    { label: '3. Color Superficie',   desc: 'Tarjetas, sidebar, paneles',   value: surfaceColor,  onChange: setSurfaceColor },
                    { label: '4. Color de Borde',     desc: 'Líneas y separadores',         value: borderColor,   onChange: setBorderColor },
                  ].map(c => (
                    <div key={c.label}>
                      <label className="form-label">{c.label}</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="color" value={c.value} onChange={e => c.onChange(e.target.value)} style={{
                          width: '44px', height: '44px', borderRadius: '8px', border: '2px solid var(--border-strong)',
                          background: 'var(--bg-elevated)', cursor: 'pointer', padding: '2px',
                        }} />
                        <div>
                          <input className="form-input" value={c.value} onChange={e => c.onChange(e.target.value)} style={{ fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", width: '110px' }} />
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>{c.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: bgColor, border: `1px solid ${borderColor}` }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vista previa</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button style={{ padding: '8px 16px', background: accentColor, color: bgColor, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'default' }}>Botón Primario</button>
                    <button style={{ padding: '8px 16px', background: 'transparent', color: accentColor, border: `1px solid ${accentColor}`, borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', cursor: 'default' }}>Botón Outline</button>
                    <span style={{ padding: '4px 12px', background: `${accentColor}22`, color: accentColor, borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>Badge Activo</span>
                    <div style={{ padding: '12px 16px', background: surfaceColor, border: `1px solid ${borderColor}`, borderRadius: '8px', fontSize: '0.78rem', color: '#94A3B8' }}>
                      Tarjeta de ejemplo
                    </div>
                  </div>
                </div>
              </div>

              {/* Guardar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {saved && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <CheckCircle2 size={16} /> Cambios guardados
                  </div>
                )}
                <button className="btn-primary" onClick={handleSave}>
                  <Save size={14} /> Guardar cambios
                </button>
              </div>
            </div>
          )}

          {activeSection !== 'Marca & Identidad' && (
            <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🚧</div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>{activeSection}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Esta sección está en desarrollo. Disponible en la próxima versión.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
