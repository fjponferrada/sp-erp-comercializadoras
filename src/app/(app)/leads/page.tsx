import LeadsClient from './LeadsClient'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const channels = await prisma.channel.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  const initialChannels = channels.map(c => c.name);
  return <LeadsClient initialChannels={initialChannels} />
}
