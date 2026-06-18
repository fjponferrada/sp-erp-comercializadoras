import LeadsClient from './LeadsClient'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';
  if (!['COMERCIAL', 'CANAL', 'BACKOFFICE', 'SUPERADMIN', 'COMPANYADMIN'].includes(userRole as string)) {
    redirect('/');
  }
  const channels = await prisma.channel.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  const initialChannels = channels.map(c => c.name);
  return <LeadsClient initialChannels={initialChannels} />
}
