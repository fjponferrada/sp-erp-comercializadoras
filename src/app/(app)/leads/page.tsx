import LeadsClient from './LeadsClient'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getChannelVisibilityFilter } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';
  if (!['COMERCIAL', 'CANAL', 'BACKOFFICE', 'SUPERADMIN', 'COMPANYADMIN'].includes(userRole as string)) {
    redirect('/');
  }
  const resolvedParams = await searchParams;
  const rawAction = Array.isArray(resolvedParams?.action) ? resolvedParams.action[0] : resolvedParams?.action;
  const rawCups = Array.isArray(resolvedParams?.cups) ? resolvedParams.cups[0] : resolvedParams?.cups;

  const channelFilter = await getChannelVisibilityFilter();
  const channels = await prisma.channel.findMany({
    where: channelFilter,
    select: { name: true },
    orderBy: { name: 'asc' }
  });
  const initialChannels = channels.map(c => c.name);
  return (
    <LeadsClient
      initialChannels={initialChannels}
      initialAction={rawAction}
      initialCups={rawCups}
    />
  )
}
