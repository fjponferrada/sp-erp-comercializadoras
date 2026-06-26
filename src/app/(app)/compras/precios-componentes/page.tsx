import Topbar from '@/components/Topbar';
import PreciosClient from './PreciosClient';
import { prisma } from '@/lib/prisma';

export default async function PreciosComponentesPage() {
  const componentRecords = await prisma.systemComponentPrice.findMany({
    distinct: ['component'],
    select: { component: true },
    orderBy: { component: 'asc' }
  });
  
  const components = componentRecords.map(r => r.component);
  if (components.length === 0) components.push('OMIE');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Precio Componentes" />
      <div style={{ padding: '24px' }}>
        <PreciosClient availableComponents={components} />
      </div>
    </div>
  );
}
