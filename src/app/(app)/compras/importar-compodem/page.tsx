import Topbar from '@/components/Topbar';
import ImportarClient from './ImportarClient';
import { prisma } from '@/lib/prisma';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

const VERSION_RANKS: Record<string, number> = {
  'A1': 1, 'C1': 2, 'A2': 3, 'C2': 4, 'C3': 5, 'C4': 6, 'C5': 7, 'C6': 8, 'C7': 9, 'C8': 10
};

export default async function ImportarCompodemPage() {
  const now = new Date();
  const startDate = startOfMonth(subMonths(now, 11)); // Last 12 months including current

  // Fetch TOTAL_COMPODEM component prices from startDate to determine the version status of the whole month
  const prices = await prisma.systemComponentPrice.findMany({
    where: { 
      date: { gte: startDate },
      component: 'TOTAL_COMPODEM'
    },
    select: { date: true, version: true }
  });

  // Group by month
  const monthlyData: Record<string, { monthDate: Date, lowestVersion: string | null, rank: number }> = {};

  // Initialize last 12 months with "Sin datos" (Infinity rank)
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const key = format(d, 'yyyy-MM');
    monthlyData[key] = { monthDate: d, lowestVersion: null, rank: Infinity };
  }

  // Calculate lowest version
  for (const p of prices) {
    if (!p.version) continue;
    const key = format(p.date, 'yyyy-MM');
    if (!monthlyData[key]) continue; // outside of 12 months range

    const rank = VERSION_RANKS[p.version] || Infinity;
    if (rank < monthlyData[key].rank) {
      monthlyData[key].rank = rank;
      monthlyData[key].lowestVersion = p.version;
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
        title="Importar COMPODEM" 
        subtitle="Carga de archivo maestro con los ficheros de liquidación de REE (C1, C2, C3, C4, C5). El sistema procesará todos los componentes internamente."
        showSearch={false}
      />

      <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <ImportarClient />

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
