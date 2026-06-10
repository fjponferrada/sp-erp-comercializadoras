import React from 'react';
import { getClientStatsAction, getPaginatedClientsAction } from '@/app/actions/clientActions';
import ClientesClient, { ClienteData } from './ClientesClient';
import { auth } from '@/auth';

export default async function ClientesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  const [statsResult, clientsResult] = await Promise.all([
    getClientStatsAction(),
    getPaginatedClientsAction(1, 100, '', 'Todos')
  ]);

  const stats = statsResult.success ? statsResult : { totalClientes: 0, conContratoActivo: 0, nuevosEsteMes: 0 };
  const initialClientes = clientsResult.success ? clientsResult.clients : [];
  const initialTotalCount = clientsResult.success ? clientsResult.totalCount : 0;

  return (
    <ClientesClient 
      initialClientes={initialClientes as any} 
      initialTotalCount={initialTotalCount as number}
      stats={stats as any}
      userRole={userRole} 
    />
  );
}
