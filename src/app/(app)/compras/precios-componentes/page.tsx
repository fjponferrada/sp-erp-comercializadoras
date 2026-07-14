import Topbar from '@/components/Topbar';
import PreciosClient from './PreciosClient';
import { prisma } from '@/lib/prisma';

import { format } from 'date-fns';

export default async function PreciosComponentesPage() {
  const componentRecords = await prisma.systemComponentPrice.findMany({
    distinct: ['component'],
    select: { component: true },
    orderBy: { component: 'asc' }
  });
  
  let components = componentRecords.map(r => r.component).filter(c => !c.startsWith('PERD_'));
  if (components.length === 0) components.push('OMIE');

  // Fetch last 12 months of RESTRICCIONES and OS
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0,0,0,0);

  const rawData = await prisma.systemComponentPrice.findMany({
    where: {
      component: { in: ['RESTRICCIONES', 'OS', 'OMIE'] },
      date: { gte: twelveMonthsAgo }
    },
    select: { component: true, date: true, values: true }
  });

  const monthlyAverages: Record<string, { RESTRICCIONES: { sum: number, count: number }, OS: { sum: number, count: number }, OMIE: { sum: number, count: number } }> = {};

  for (const row of rawData) {
    const monthKey = format(new Date(row.date), 'yyyy-MM');
    if (!monthlyAverages[monthKey]) {
      monthlyAverages[monthKey] = {
        RESTRICCIONES: { sum: 0, count: 0 },
        OS: { sum: 0, count: 0 },
        OMIE: { sum: 0, count: 0 }
      };
    }
    
    const values = row.values as number[];
    if (values && values.length > 0) {
      const dailySum = values.reduce((a, b) => a + b, 0);
      monthlyAverages[monthKey][row.component as 'RESTRICCIONES'|'OS'|'OMIE'].sum += dailySum;
      monthlyAverages[monthKey][row.component as 'RESTRICCIONES'|'OS'|'OMIE'].count += values.length;
    }
  }

  const monthlyAveragesList = Object.keys(monthlyAverages).sort((a,b) => b.localeCompare(a)).map(month => {
    const data = monthlyAverages[month];
    return {
      month,
      restricciones: data.RESTRICCIONES.count > 0 ? (data.RESTRICCIONES.sum / data.RESTRICCIONES.count).toFixed(2) : '-',
      os: data.OS.count > 0 ? (data.OS.sum / data.OS.count).toFixed(2) : '-',
      omie: data.OMIE.count > 0 ? (data.OMIE.sum / data.OMIE.count).toFixed(2) : '-'
    };
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Precio Componentes" />
      <div style={{ padding: '24px' }}>
        <PreciosClient availableComponents={components} monthlyAverages={monthlyAveragesList} />
      </div>
    </div>
  );
}
