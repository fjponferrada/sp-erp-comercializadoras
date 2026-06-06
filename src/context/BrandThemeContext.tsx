'use client';

import React, { createContext, useContext, useEffect } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface BrandTheme {
  name: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  accentColor: string;  // Color protagonista (botones, badges, highlights)
  bgColor: string;      // Fondo base de toda la app
  surfaceColor: string; // Tarjetas, sidebar
  borderColor: string;  // Separadores y bordes
}

// ── Derivar colores secundarios automáticamente ───────────────────────────
// A partir de los 4 colores base, calculamos el resto del sistema
function deriveThemeVars(theme: BrandTheme): Record<string, string> {
  return {
    '--lime':           theme.accentColor,
    '--lime-dark':      darken(theme.accentColor, 20),
    '--lime-glow':      hexToRgba(theme.accentColor, 0.15),
    '--lime-glow-lg':   hexToRgba(theme.accentColor, 0.08),
    '--bg-base':        theme.bgColor,
    '--bg-surface':     theme.surfaceColor,
    '--bg-elevated':    lighten(theme.surfaceColor, 8),
    '--border':         theme.borderColor,
    '--border-strong':  lighten(theme.borderColor, 8),
    '--text-primary':   '#FFFFFF',
    '--text-secondary': '#94A3B8',
    '--text-muted':     '#64748B',
    '--success':        '#22C55E',
    '--warning':        '#F59E0B',
    '--danger':         '#EF4444',
    '--info':           '#3B82F6',
  };
}

// ── Utilidades de color ────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = 1 - amount / 100;
  return rgbToHex(
    Math.max(0, Math.round(r * factor)),
    Math.max(0, Math.round(g * factor)),
    Math.max(0, Math.round(b * factor)),
  );
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount),
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── Tema por defecto (SP Energía) ──────────────────────────────────────────
export const defaultTheme: BrandTheme = {
  name:         'SP Energía ERP',
  logoUrl:      null,
  faviconUrl:   null,
  accentColor:  '#DEFF9A',
  bgColor:      '#0B0F19',
  surfaceColor: '#111827',
  borderColor:  '#1E2A3A',
};

// ── Contexto React ─────────────────────────────────────────────────────────
const BrandThemeContext = createContext<BrandTheme>(defaultTheme);

export function useBrandTheme() {
  return useContext(BrandThemeContext);
}

// ── Provider ───────────────────────────────────────────────────────────────
interface BrandThemeProviderProps {
  theme: BrandTheme;
  children: React.ReactNode;
}

export function BrandThemeProvider({ theme, children }: BrandThemeProviderProps) {
  // Inyectar variables CSS en el <html> cada vez que cambia el tema
  useEffect(() => {
    const vars = deriveThemeVars(theme);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Favicon dinámico
    if (theme.faviconUrl) {
      const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
        || Object.assign(document.createElement('link'), { rel: 'icon' });
      link.href = theme.faviconUrl;
      document.head.appendChild(link);
    }
  }, [theme]);

  return (
    <BrandThemeContext.Provider value={theme}>
      {children}
    </BrandThemeContext.Provider>
  );
}
