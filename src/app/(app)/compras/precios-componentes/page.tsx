import Topbar from '@/components/Topbar';
import PreciosClient from './PreciosClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { startOfMonth, subMonths } from 'date-fns';
import { isComprasAuthorized } from '@/lib/reganecuServer';

export const dynamic = 'force-dynamic';

const PRIORITY_COMPONENTS = ['OMIE', 'TOTAL_COMPODEM', 'RESTRICCIONES', 'OS', 'K'];

export default async function PreciosComponentesPage() {
  const session = await auth();
  if (!isComprasAuthorized(session)) {
    redirect('/login');
  }

  const componentRecords = await prisma.systemComponentPrice.findMany({
    distinct: ['component'],
    select: { component: true },
    orderBy: { component: 'asc' },
  });

  const rawComponents = componentRecords
    .map(r => r.component)
    .filter(c => !c.startsWith('PERD_'));

  const components = Array.from(new Set(rawComponents.length > 0 ? rawComponents : ['OMIE'])).sort(
    (a, b) => {
      const idxA = PRIORITY_COMPONENTS.indexOf(a);
      const idxB = PRIORITY_COMPONENTS.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    }
  );

  // Evita desbordamiento de setMonth en días 31 usando startOfMonth + UTC puro
  const currentMonthStart = startOfMonth(new Date());
  const earliestMonth = subMonths(currentMonthStart, 11);
  const startDateUtc = new Date(
    Date.UTC(earliestMonth.getFullYear(), earliestMonth.getMonth(), 1)
  );

  const rawData = await prisma.systemComponentPrice.findMany({
    where: {
      component: { in: ['RESTRICCIONES', 'OS', 'OMIE'] },
      date: { gte: startDateUtc },
    },
    select: { component: true, date: true, values: true },
  });

  const monthlyAverages: Record<
    string,
    {
      RESTRICCIONES: { sumDailyAvg: number; dayCount: number };
      OS: { sumDailyAvg: number; dayCount: number };
      OMIE: { sumDailyAvg: number; dayCount: number };
    }
  > = {};

  for (const row of rawData) {
    const monthKey = row.date.toISOString().slice(0, 7);
    if (!monthlyAverages[monthKey]) {
      monthlyAverages[monthKey] = {
        RESTRICCIONES: { sumDailyAvg: 0, dayCount: 0 },
        OS: { sumDailyAvg: 0, dayCount: 0 },
        OMIE: { sumDailyAvg: 0, dayCount: 0 },
      };
    }

    const values = row.values as number[];
    if (values && values.length > 0) {
      // Promediar cada día primero para que días de 24h y días de 96qh pesen exactamente 1 día
      const dailyAvg = values.reduce((a, b) => a + b, 0) / values.length;
      const compKey = row.component as 'RESTRICCIONES' | 'OS' | 'OMIE';
      monthlyAverages[monthKey][compKey].sumDailyAvg += dailyAvg;
      monthlyAverages[monthKey][compKey].dayCount += 1;
    }
  }

  const monthlyAveragesList = Object.keys(monthlyAverages)
    .sort((a, b) => b.localeCompare(a))
    .map(month => {
      const data = monthlyAverages[month];
      return {
        month,
        restricciones:
          data.RESTRICCIONES.dayCount > 0
            ? (data.RESTRICCIONES.sumDailyAvg / data.RESTRICCIONES.dayCount).toFixed(2)
            : null,
        os:
          data.OS.dayCount > 0
            ? (data.OS.sumDailyAvg / data.OS.dayCount).toFixed(2)
            : null,
        omie:
          data.OMIE.dayCount > 0
            ? (data.OMIE.sumDailyAvg / data.OMIE.dayCount).toFixed(2)
            : null,
      };
    });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Precio Componentes" showSearch={false} />
      <div style={{ padding: '24px' }}>
        <PreciosClient availableComponents={components} monthlyAverages={monthlyAveragesList} />
      </div>
    </div>
  );
}
