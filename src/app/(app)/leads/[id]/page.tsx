import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import LeadDetailsClient from './LeadDetailsClient'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: resolvedParams.id },
    include: {
      documents: true,
      user: true,
      contract: {
        include: {
          client: true,
          supplyPoint: true
        }
      }
    }
  })

  if (!lead) {
    notFound()
  }

  // Convert dates and handle nulls for the client component
  const safeLead = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }

  return <LeadDetailClient initialLead={safeLead} />
}
