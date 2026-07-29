import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import MassCommsClient from './MassCommsClient';
import { getSupplyPointsForComms } from '@/app/actions/commsActions';

export const dynamic = 'force-dynamic';

export default async function ComunicacionesMasivasPage() {
  const session = await auth();
  const role = session?.user?.role;

  // Solo permitir a roles de Backoffice
  if (role !== 'SUPERADMIN' && role !== 'COMPANYADMIN' && role !== 'BACKOFFICE') {
    redirect('/');
  }

  // Cargar datos iniciales
  const response = await getSupplyPointsForComms();
  const initialData = response.success ? response.data : [];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Comunicaciones Masivas
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
        Envía correos electrónicos masivos a clientes filtrando por estado o canal. 
        El envío agrupará a los clientes con varios CUPS para no duplicar correos.
      </p>

      <MassCommsClient initialData={initialData || []} />
    </div>
  );
}
