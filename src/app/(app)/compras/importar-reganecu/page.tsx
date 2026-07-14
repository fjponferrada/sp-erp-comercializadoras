import Topbar from '@/components/Topbar';
import ReganecuImportClient from './ReganecuImportClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

const VERSION_RANKS: Record<string, number> = {
  'A1': 1, 'C1': 2, 'A2': 3, 'C2': 4, 'C3': 5, 'C4': 6, 'C5': 7, 'C6': 8, 'C7': 9, 'C8': 10
};

export default async function ImportarReganecuPage() {
  const session = await auth();

  if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
    redirect('/login');
  }

  const now = new Date();
  const startDate = startOfMonth(subMonths(now, 11)); // Last 12 months including current

  // Fetch REGANECU data from startDate to determine the version status of the whole month
  const records = await prisma.reganecuData.findMany({
    where: { 
      companyId: session.user.companyId,
      date: { gte: startDate },
      matricial: false, // We just need one entry per day, total=true is guaranteed
      total: true
    },
    select: { date: true, cierre: true }
  });

  // Group by month
  const monthlyData: Record<string, { monthDate: Date, lowestVersion: string | null, rank: number }> = {};

  // Initialize last 12 months with "Sin datos" (Infinity rank)
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const key = format(d, 'yyyy-MM');
    monthlyData[key] = { monthDate: d, lowestVersion: null, rank: Infinity };
  }

  // First, find the highest version for each day
  const dailyHighest: Record<string, number> = {};
  for (const r of records) {
    if (!r.cierre) continue;
    const dayKey = format(r.date, 'yyyy-MM-dd');
    const rank = VERSION_RANKS[r.cierre] || 0; // Higher is newer
    if (!dailyHighest[dayKey] || rank > dailyHighest[dayKey]) {
      dailyHighest[dayKey] = rank;
    }
  }

  // Now, calculate the lowest version among the highest versions of each day in the month
  for (const dayKey of Object.keys(dailyHighest)) {
    const monthKey = dayKey.substring(0, 7); // yyyy-MM
    if (!monthlyData[monthKey]) continue;

    const rank = dailyHighest[dayKey];
    if (rank < monthlyData[monthKey].rank) {
      monthlyData[monthKey].rank = rank;
      // Find the name of the closure from the rank
      monthlyData[monthKey].lowestVersion = Object.keys(VERSION_RANKS).find(k => VERSION_RANKS[k] === rank) || null;
    }
  }

  // Sort months descending (newest first)
  const sortedMonths = Object.values(monthlyData).sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());

  // Function to get styling based on version
  const getBadgeStyle = (version: string | null) => {
    if (!version) return { background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' };
    if (version.startsWith('A')) return { background: 'rgba(245, 158, 11, 0.2)', color: '#FCD34D' };
    if (version === 'C1' || version === 'C2') return { background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' };
    if (version === 'C8') return { background: 'var(--lime-glow)', color: 'var(--lime)' };
    return { background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD' };
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Importar Liquidaciones REGANECU" 
        subtitle="Carga de archivo con las liquidaciones de REE. El sistema procesará los datos para el análisis de desvíos."
        showSearch={false}
      />
      <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <a 
            href="https://participa.esios.ree.es" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink size={16} style={{ marginRight: '8px' }} />
            Acceder a ESIOS Participa
          </a>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Subida de Archivos ZIP (REGANECU)
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.875rem' }}>
            Sube un archivo ZIP que contenga liquidaciones particulares de REE (ej. C2_liquidacion_AEDEN_202603.1.zip). También puedes subir un ZIP que contenga varios archivos ZIP de liquidaciones en su interior.
          </p>
          
          <ReganecuImportClient />
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Estado de Actualización (Últimos 12 meses)
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Se muestra la liquidación más antigua encontrada de cualquier día dentro del mes correspondiente.
            </p>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 24px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mes</th>
                  <th style={{ padding: '12px 24px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado (Versión más antigua)</th>
                </tr>
              </thead>
              <tbody>
                {sortedMonths.map((m) => (
                  <tr key={format(m.monthDate, 'yyyy-MM')} className="hover:bg-[var(--bg-elevated)] transition-colors duration-200" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {format(m.monthDate, 'MMMM yyyy', { locale: es })}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.875rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        ...getBadgeStyle(m.lowestVersion)
                      }}>
                        {m.lowestVersion || 'Sin datos'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
