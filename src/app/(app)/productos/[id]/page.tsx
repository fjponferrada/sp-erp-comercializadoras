import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { auth } from '@/auth';
import { getAuthorizedProductsWhereClause } from '@/app/actions/productActions';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  if ((session.user as any).role === 'CLIENT') {
    redirect('/mi-energia');
  }

  const whereClause = await getAuthorizedProductsWhereClause();
  if (!whereClause) {
    redirect('/unauthorized');
  }

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: {
      id,
      ...whereClause,
    },
    include: { brand: true },
  });

  if (!product) {
    notFound();
  }

  // Sanitizar márgenes mayoristas confidenciales en el RSC Payload
  const { marginFC, ip1, ip2, ip3, ip4, ip5, ip6, airtableData, ...safeProduct } = product;

  return <ProductDetailClient product={safeProduct} />;
}
