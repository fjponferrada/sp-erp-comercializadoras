import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import LeadDetailClient from './LeadDetailClient'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

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

  let productName = lead.product;
  let productType = lead.productType;
  let fullProduct = null;
  if (lead.product) {
    let p = null;
    if (lead.product.startsWith('cm')) {
      p = await prisma.product.findUnique({ where: { id: lead.product } });
    } else {
      p = await prisma.product.findFirst({ where: { name: lead.product.trim() } });
    }
    if (p) {
      productName = p.name;
      productType = p.type;
      fullProduct = p;
    }
  }

  // Distributor fallback
  let distributorCode = null;
  let distributorName = null;
  if (lead.cups && lead.cups.length >= 6) {
    distributorCode = lead.cups.substring(2, 6);
    const dist = await prisma.distributor.findUnique({ where: { reeCode: distributorCode } });
    if (dist) {
      distributorName = `[${dist.reeCode}] ${dist.name}`;
    }
  }

  // SupplyPoint fallback
  let dbSupplyPoint = lead.contract?.supplyPoint || null;
  if (!dbSupplyPoint && lead.cups) {
    dbSupplyPoint = await prisma.supplyPoint.findFirst({
      where: {
        cups: { startsWith: lead.cups.substring(0, 20) },
        client: { brandId: lead.user.brandId }
      }
    });
  }

  // Client fallback
  let dbClient = lead.contract?.client || null;
  if (!dbClient && lead.vatNumber) {
    dbClient = await prisma.client.findFirst({
      where: {
        vatNumber: lead.vatNumber,
        brandId: lead.user.brandId
      }
    });
  }

  const safeLead = {
    ...lead,
    productName: productName,
    productType: productType,
    dbProduct: fullProduct,
    dbSupplyPoint: dbSupplyPoint,
    dbClient: dbClient,
    dbDistributor: distributorName,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }

  return <LeadDetailClient initialLead={safeLead as any} />
}
