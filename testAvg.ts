import { prisma } from './src/lib/prisma';
import { format } from 'date-fns';

async function run() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0,0,0,0);

  const rawData = await prisma.systemComponentPrice.findMany({
    where: {
      component: { in: ['RESTRICCIONES', 'OS'] },
      date: { gte: twelveMonthsAgo }
    },
    select: { component: true, date: true, values: true }
  });

  const monthlyAverages: Record<string, { RESTRICCIONES: { sum: number, count: number }, OS: { sum: number, count: number } }> = {};

  for (const row of rawData) {
    const monthKey = format(new Date(row.date), 'yyyy-MM');
    if (!monthlyAverages[monthKey]) {
      monthlyAverages[monthKey] = {
        RESTRICCIONES: { sum: 0, count: 0 },
        OS: { sum: 0, count: 0 }
      };
    }
    
    // Average of the 96 values for this day
    const values = row.values as number[];
    if (values && values.length > 0) {
      const dailyAvg = values.reduce((a, b) => a + b, 0) / values.length;
      monthlyAverages[monthKey][row.component as 'RESTRICCIONES'|'OS'].sum += dailyAvg;
      monthlyAverages[monthKey][row.component as 'RESTRICCIONES'|'OS'].count += 1;
    }
  }

  const result = Object.keys(monthlyAverages).sort().map(month => {
    const data = monthlyAverages[month];
    return {
      month,
      restricciones: data.RESTRICCIONES.count > 0 ? (data.RESTRICCIONES.sum / data.RESTRICCIONES.count).toFixed(2) : '-',
      os: data.OS.count > 0 ? (data.OS.sum / data.OS.count).toFixed(2) : '-'
    };
  });

  console.log(result);
}
run().finally(() => prisma['$disconnect']());
