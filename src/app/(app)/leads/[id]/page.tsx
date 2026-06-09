import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import LeadDetailClient from './LeadDetailClient'
import { notFound } from 'next/navigation'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

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
